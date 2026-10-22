package com.settlehub.service;

import com.settlehub.dto.CreateExpenseRequest;
import com.settlehub.dto.ExpenseDto;
import com.settlehub.engine.EqualSplitStrategy;
import com.settlehub.engine.ExactSplitStrategy;
import com.settlehub.engine.PercentageSplitStrategy;
import com.settlehub.engine.SplitStrategy;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.*;
import com.settlehub.repository.ExpenseReceiptRepository;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseReceiptRepository receiptRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final EqualSplitStrategy equalSplitStrategy;
    private final ExactSplitStrategy exactSplitStrategy;
    private final PercentageSplitStrategy percentageSplitStrategy;
    private final GroupAccessService access;
    private final ActivityService activityService;
    private final WebSocketEventPublisher events;
    private final int maxReceiptChars;

    public ExpenseService(ExpenseRepository expenseRepository,
                          ExpenseReceiptRepository receiptRepository,
                          GroupRepository groupRepository,
                          GroupMemberRepository groupMemberRepository,
                          EqualSplitStrategy equalSplitStrategy,
                          ExactSplitStrategy exactSplitStrategy,
                          PercentageSplitStrategy percentageSplitStrategy,
                          GroupAccessService access,
                          ActivityService activityService,
                          WebSocketEventPublisher events,
                          @Value("${app.receipts.max-chars:480000}") int maxReceiptChars) {
        this.expenseRepository = expenseRepository;
        this.receiptRepository = receiptRepository;
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.equalSplitStrategy = equalSplitStrategy;
        this.exactSplitStrategy = exactSplitStrategy;
        this.percentageSplitStrategy = percentageSplitStrategy;
        this.access = access;
        this.activityService = activityService;
        this.events = events;
        this.maxReceiptChars = maxReceiptChars;
    }

    @Transactional
    public ExpenseDto createExpense(UUID groupId, UUID currentUserId, CreateExpenseRequest request) {
        GroupMember me = access.requireMember(groupId, currentUserId);
        Group group = me.getGroup();
        Map<UUID, User> members = membersById(groupId);

        Expense expense = new Expense(group, request.description().trim(), request.costCents(), group.getCurrencyCode(),
            request.date(), "EQUAL", false, me.getUser());
        apply(expense, group, members, me.getUser(), request);
        Expense saved = expenseRepository.save(expense);
        saveReceipt(saved, request.receiptUrl());

        touch(group);
        activityService.record(group, me.getUser(), Activity.Type.EXPENSE_CREATED,
            me.getUser().getFirstName() + " added \"" + saved.getDescription() + "\"", saved.getCostCents());
        events.publishGroupEvent(groupId, "EXPENSE_CREATED", currentUserId, saved.getId());
        return ExpenseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<ExpenseDto> getExpensesForGroup(UUID groupId, UUID currentUserId) {
        access.requireMember(groupId, currentUserId);
        return expenseRepository.findActiveByGroupId(groupId).stream()
            .map(ExpenseDto::fromEntity)
            .toList();
    }

    @Transactional
    public ExpenseDto updateExpense(UUID expenseId, UUID currentUserId, CreateExpenseRequest request) {
        Expense expense = access.requireExpense(expenseId, currentUserId);
        if (expense.isPayment()) {
            throw new IllegalArgumentException("Payments cannot be edited; delete the settlement instead");
        }
        Group group = expense.getGroup();
        Map<UUID, User> members = membersById(group.getId());
        User actor = members.get(currentUserId);
        long previousCost = expense.getCostCents();

        expense.setDescription(request.description().trim());
        expense.setCostCents(request.costCents());
        if (request.date() != null) {
            expense.setDate(request.date());
        }
        expense.getPayers().clear();
        expense.getSplits().clear();
        // Drop the cleared rows before inserting replacements for the same users
        expenseRepository.saveAndFlush(expense);

        apply(expense, group, members, expense.getCreatedBy(), request);
        expense.setUpdatedAt(Instant.now());
        Expense saved = expenseRepository.save(expense);
        if (request.receiptUrl() != null) {
            receiptRepository.findById(saved.getId()).ifPresent(receiptRepository::delete);
            saved.setHasReceipt(false);
            saveReceipt(saved, request.receiptUrl());
        }

        touch(group);
        String summary = actor.getFirstName() + " edited \"" + saved.getDescription() + "\"";
        if (previousCost != saved.getCostCents()) {
            summary += " (" + CurrencyUtil.formatCents(previousCost, group.getCurrencyCode()) + " → "
                + CurrencyUtil.formatCents(saved.getCostCents(), group.getCurrencyCode()) + ")";
        }
        activityService.record(group, actor, Activity.Type.EXPENSE_UPDATED, summary, saved.getCostCents());
        events.publishGroupEvent(group.getId(), "EXPENSE_UPDATED", currentUserId, saved.getId());
        return ExpenseDto.fromEntity(saved);
    }

    @Transactional
    public void deleteExpense(UUID expenseId, UUID currentUserId) {
        Expense expense = access.requireExpense(expenseId, currentUserId);
        Group group = expense.getGroup();
        User actor = membersById(group.getId()).get(currentUserId);
        expense.setDeletedAt(Instant.now());
        expenseRepository.save(expense);

        touch(group);
        activityService.record(group, actor, Activity.Type.EXPENSE_DELETED,
            actor.getFirstName() + " deleted \"" + expense.getDescription() + "\"", expense.getCostCents());
        events.publishGroupEvent(group.getId(), "EXPENSE_DELETED", currentUserId, expenseId);
    }

    @Transactional(readOnly = true)
    public String getReceipt(UUID expenseId, UUID currentUserId) {
        Expense expense = access.requireExpense(expenseId, currentUserId);
        return receiptRepository.findById(expense.getId())
            .map(ExpenseReceipt::getDataUrl)
            .orElseThrow(() -> new NotFoundException("This expense has no receipt"));
    }

    // ---------------------------------------------------------------- shared create/update logic

    private void apply(Expense expense, Group group, Map<UUID, User> members, User defaultPayer, CreateExpenseRequest request) {
        long totalCostCents = request.costCents();
        String groupCurrency = group.getCurrencyCode();

        if (request.currencyCode() != null && !request.currencyCode().isBlank()
                && !CurrencyUtil.normalize(request.currencyCode()).equals(groupCurrency)) {
            throw new IllegalArgumentException("Amounts must be in the group currency (" + groupCurrency
                + "). Convert foreign amounts first; the original can be kept in originalCurrency/originalAmountCents.");
        }
        boolean hasOriginal = request.originalCurrency() != null && !request.originalCurrency().isBlank()
            && request.originalAmountCents() != null
            && !CurrencyUtil.normalize(request.originalCurrency()).equals(groupCurrency);
        expense.setCurrencyCode(groupCurrency);
        expense.setOriginalCurrency(hasOriginal ? CurrencyUtil.normalize(request.originalCurrency()) : null);
        expense.setOriginalAmountCents(hasOriginal ? request.originalAmountCents() : null);

        String method = request.creationMethod() != null && !request.creationMethod().isBlank()
            ? request.creationMethod().toUpperCase(Locale.ROOT) : "EQUAL";
        expense.setCreationMethod(method);
        if (request.category() != null && !request.category().isBlank()) {
            expense.setCategory(request.category());
        }
        expense.setNotes(request.notes() != null && !request.notes().isBlank() ? request.notes().trim() : null);

        // Splits
        List<UUID> participantIds = new ArrayList<>();
        Map<UUID, Object> splitParams = new HashMap<>();
        for (CreateExpenseRequest.SplitRequest sr : request.splits()) {
            requireMember(members, sr.userId());
            participantIds.add(sr.userId());
            if ("PERCENT".equals(method)) {
                splitParams.put(sr.userId(), sr.percentage() != null ? sr.percentage() : 0.0);
            } else if ("EXACT".equals(method)) {
                splitParams.put(sr.userId(), sr.owedCents() != null ? sr.owedCents() : 0L);
            }
        }
        SplitStrategy strategy = switch (method) {
            case "EXACT" -> exactSplitStrategy;
            case "PERCENT" -> percentageSplitStrategy;
            default -> equalSplitStrategy;
        };
        Map<UUID, Long> calculatedSplits = strategy.calculateSplits(totalCostCents, participantIds, splitParams);
        long sumSplits = calculatedSplits.values().stream().mapToLong(Long::longValue).sum();
        if (sumSplits != totalCostCents) {
            throw new IllegalArgumentException(String.format(
                "Calculated splits (%d cents) do not match total expense cost (%d cents).", sumSplits, totalCostCents));
        }

        // Payers (default: the creator paid everything)
        if (request.payers() == null || request.payers().isEmpty()) {
            expense.addPayer(defaultPayer, totalCostCents);
        } else {
            Set<UUID> seen = new HashSet<>();
            long totalPaid = 0L;
            for (CreateExpenseRequest.PayerRequest pr : request.payers()) {
                if (pr.paidCents() == 0) continue;
                if (!seen.add(pr.userId())) {
                    throw new IllegalArgumentException("Each payer can only appear once.");
                }
                expense.addPayer(requireMember(members, pr.userId()), pr.paidCents());
                totalPaid += pr.paidCents();
            }
            if (totalPaid != totalCostCents) {
                throw new IllegalArgumentException(String.format(
                    "Total paid amounts (%d cents) do not match expense cost (%d cents).", totalPaid, totalCostCents));
            }
        }

        for (Map.Entry<UUID, Long> entry : calculatedSplits.entrySet()) {
            expense.addSplit(members.get(entry.getKey()), entry.getValue());
        }
    }

    private void saveReceipt(Expense expense, String receiptUrl) {
        if (receiptUrl == null || receiptUrl.isBlank()) return;
        String value = receiptUrl.trim();
        if (!value.startsWith("data:image/") && !value.startsWith("https://")) {
            throw new IllegalArgumentException("Receipt must be an image");
        }
        if (value.length() > maxReceiptChars) {
            throw new IllegalArgumentException("Receipt image is too large; please use a smaller photo");
        }
        receiptRepository.save(new ExpenseReceipt(expense.getId(), value));
        expense.setHasReceipt(true);
        expenseRepository.save(expense);
    }

    private Map<UUID, User> membersById(UUID groupId) {
        return groupMemberRepository.findAllByGroupId(groupId).stream()
            .map(GroupMember::getUser)
            .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static User requireMember(Map<UUID, User> members, UUID userId) {
        User user = members.get(userId);
        if (user == null) {
            throw new IllegalArgumentException("Everyone in an expense must be a member of the group");
        }
        return user;
    }

    private void touch(Group group) {
        group.setUpdatedAt(Instant.now());
        groupRepository.save(group);
    }
}
