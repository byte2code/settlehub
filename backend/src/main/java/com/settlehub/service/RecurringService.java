package com.settlehub.service;

import com.settlehub.dto.CreateExpenseRequest;
import com.settlehub.dto.RecurringDtos.CreateRequest;
import com.settlehub.dto.RecurringDtos.RecurringDto;
import com.settlehub.exception.BadRequestException;
import com.settlehub.exception.ForbiddenException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.Group;
import com.settlehub.model.RecurringExpense;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.RecurringExpenseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Repeating equal-split expenses (rent, subscriptions). Generation is idempotent: every occurrence has a client id
 * derived from (template, date), so two triggers at once, or a restart mid-run, can never create a duplicate.
 * Dates are plain UTC calendar dates; the 31st in a short month uses the last day of that month.
 */
@Service
public class RecurringService {

    private static final Logger log = LoggerFactory.getLogger(RecurringService.class);
    static final int MAX_PER_GROUP = 10;
    static final int MAX_CATCH_UP = 12;

    private final RecurringExpenseRepository repository;
    private final GroupAccessService access;
    private final GroupMemberRepository memberRepository;
    private final GroupRepository groupRepository;
    private final ExpenseService expenseService;
    private final TransactionTemplate tx;

    public RecurringService(RecurringExpenseRepository repository, GroupAccessService access, GroupMemberRepository memberRepository,
                            GroupRepository groupRepository, ExpenseService expenseService, PlatformTransactionManager txManager) {
        this.repository = repository;
        this.access = access;
        this.memberRepository = memberRepository;
        this.groupRepository = groupRepository;
        this.expenseService = expenseService;
        this.tx = new TransactionTemplate(txManager);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public static LocalDate advance(LocalDate from, String frequency, int dayOfMonth) {
        if ("WEEKLY".equals(frequency)) return from.plusDays(7);
        YearMonth next = YearMonth.from(from).plusMonths(1);
        return next.atDay(Math.min(dayOfMonth, next.lengthOfMonth()));
    }

    @Transactional
    public RecurringDto create(UUID groupId, UUID userId, CreateRequest req) {
        Group group = access.requireGroup(groupId, userId);
        if (group.isArchived()) throw new ForbiddenException("This group is archived, so it's read-only");
        if (repository.countByGroupIdAndActiveTrue(groupId) >= MAX_PER_GROUP) {
            throw new BadRequestException("A group can have up to " + MAX_PER_GROUP + " repeating expenses");
        }
        Set<UUID> members = memberRepository.findAllByGroupId(groupId).stream().map(m -> m.getUser().getId()).collect(Collectors.toSet());
        Set<UUID> participants = new LinkedHashSet<>(req.participantIds());
        if (!members.contains(req.payerId()) || !members.containsAll(participants)) {
            throw new BadRequestException("Everyone in a repeating expense must be a member of the group");
        }
        LocalDate start = req.startDate() != null ? req.startDate() : LocalDate.now(ZoneOffset.UTC);
        RecurringExpense r = new RecurringExpense();
        r.setGroupId(groupId);
        r.setCreatedById(userId);
        r.setDescription(req.description().trim());
        r.setCostCents(req.costCents());
        r.setCategory(req.category() == null || req.category().isBlank() ? "OTHER" : req.category());
        r.setPayerId(req.payerId());
        r.setParticipants(participants.stream().map(UUID::toString).collect(Collectors.joining(",")));
        r.setFrequency(req.frequency());
        r.setDayOfMonth(start.getDayOfMonth());
        r.setNextRunDate(advance(start, req.frequency(), start.getDayOfMonth()));
        return RecurringDto.fromEntity(repository.save(r), group.getCurrencyCode());
    }

    @Transactional(readOnly = true)
    public List<RecurringDto> list(UUID groupId, UUID userId) {
        Group group = access.requireGroup(groupId, userId);
        return repository.findByGroupIdOrderByNextRunDateAsc(groupId).stream().map(r -> RecurringDto.fromEntity(r, group.getCurrencyCode())).toList();
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        RecurringExpense r = repository.findById(id).orElseThrow(() -> new NotFoundException("Repeating expense not found"));
        access.requireMember(r.getGroupId(), userId); // non-members get "not found"
        if (!r.getCreatedById().equals(userId)) access.requireAdmin(r.getGroupId(), userId);
        repository.delete(r);
    }

    /** Creates whatever is due for one group. Safe to call on every page open. */
    public int runForGroup(UUID groupId, UUID userId) {
        access.requireMember(groupId, userId);
        return generate(repository.findByGroupIdAndActiveTrueAndNextRunDateLessThanEqual(groupId, LocalDate.now(ZoneOffset.UTC)));
    }

    /** For the external scheduler. */
    public int runAll() {
        return generate(repository.findByActiveTrueAndNextRunDateLessThanEqual(LocalDate.now(ZoneOffset.UTC)));
    }

    private int generate(List<RecurringExpense> due) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        int created = 0;
        for (RecurringExpense template : due) {
            for (int i = 0; i < MAX_CATCH_UP; i++) {
                Boolean made;
                try {
                    made = tx.execute(status -> generateOne(template.getId(), today));
                } catch (RuntimeException e) {
                    log.warn("Skipping repeating expense {}: {}", template.getId(), e.getMessage());
                    break;
                }
                if (made == null) break;      // nothing more to do for this template
                if (made) created++;
            }
        }
        return created;
    }

    /** One occurrence in its own transaction. Returns true if an expense was created, false if skipped, null when finished. */
    private Boolean generateOne(UUID id, LocalDate today) {
        RecurringExpense r = repository.findById(id).orElse(null);
        if (r == null || !r.isActive() || r.getNextRunDate().isAfter(today)) return null;
        Group group = groupRepository.findById(r.getGroupId()).orElse(null);
        if (group == null || group.isArchived()) return null; // paused while archived; resumes (and catches up) when restored

        Set<UUID> members = memberRepository.findAllByGroupId(r.getGroupId()).stream().map(m -> m.getUser().getId()).collect(Collectors.toSet());
        List<UUID> participants = Arrays.stream(r.getParticipants().split(",")).map(UUID::fromString).toList();
        if (!members.contains(r.getCreatedById()) || !members.contains(r.getPayerId()) || !members.containsAll(participants)) {
            r.setActive(false);
            r.setPausedReason("Paused: someone left the group");
            repository.save(r);
            return null;
        }
        LocalDate date = r.getNextRunDate();
        UUID clientId = UUID.nameUUIDFromBytes((r.getId() + "|" + date).getBytes(StandardCharsets.UTF_8));
        expenseService.createExpense(r.getGroupId(), r.getCreatedById(), new CreateExpenseRequest(
            r.getDescription(), r.getCostCents(), null, date.atTime(12, 0).toInstant(ZoneOffset.UTC), r.getCategory(), null, "EQUAL",
            List.of(new CreateExpenseRequest.PayerRequest(r.getPayerId(), r.getCostCents())),
            participants.stream().map(p -> new CreateExpenseRequest.SplitRequest(p, null, null)).toList(),
            "Repeats " + (r.getFrequency().equals("WEEKLY") ? "every week" : "every month"), null, null, clientId));
        r.setNextRunDate(advance(date, r.getFrequency(), r.getDayOfMonth()));
        repository.save(r);
        return true;
    }
}
