package com.settlehub.service;

import com.settlehub.dto.AwardsDtos.Award;
import com.settlehub.dto.AwardsDtos.AwardsResponse;
import com.settlehub.exception.BadRequestException;
import com.settlehub.model.*;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.SettlementRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Playful end-of-trip awards. A group admin "reveals" them once; the result is stored as a snapshot,
 * so later edits don't change what people already saw. Needs 3 members and 5 expenses.
 */
@Service
public class AwardsService {

    static final int MIN_MEMBERS = 3;
    static final int MIN_EXPENSES = 5;

    private final GroupAccessService access;
    private final GroupMemberRepository memberRepository;
    private final GroupRepository groupRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final BalanceService balanceService;
    private final ObjectMapper mapper;

    public AwardsService(GroupAccessService access, GroupMemberRepository memberRepository, GroupRepository groupRepository,
                         ExpenseRepository expenseRepository, SettlementRepository settlementRepository,
                         BalanceService balanceService, ObjectMapper mapper) {
        this.access = access;
        this.memberRepository = memberRepository;
        this.groupRepository = groupRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.balanceService = balanceService;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public AwardsResponse get(UUID groupId, UUID userId) {
        Group group = access.requireGroup(groupId, userId);
        if (group.getAwardsJson() != null) {
            try {
                AwardsResponse stored = mapper.readValue(group.getAwardsJson(), AwardsResponse.class);
                return new AwardsResponse(true, true, null, group.getAwardsRevealedAt(), stored.awards());
            } catch (Exception ignored) {
                // fall through: treat a corrupt snapshot as not revealed
            }
        }
        String why = ineligibleReason(groupId);
        return new AwardsResponse(false, why == null, why, null, List.of());
    }

    @Transactional
    public AwardsResponse reveal(UUID groupId, UUID adminId) {
        Group group = access.requireAdmin(groupId, adminId).getGroup();
        String why = ineligibleReason(groupId);
        if (why != null) throw new BadRequestException(why);
        List<Award> awards = compute(groupId, group);
        AwardsResponse response = new AwardsResponse(true, true, null, Instant.now(), awards);
        try {
            group.setAwards(mapper.writeValueAsString(response), response.revealedAt());
        } catch (Exception e) {
            throw new IllegalStateException("Could not store awards");
        }
        groupRepository.save(group);
        return response;
    }

    @Transactional
    public void hide(UUID groupId, UUID adminId) {
        Group group = access.requireAdmin(groupId, adminId).getGroup();
        group.setAwards(null, null);
        groupRepository.save(group);
    }

    private String ineligibleReason(UUID groupId) {
        long members = memberRepository.countByGroupId(groupId);
        long expenses = expenseRepository.findActiveIdsByGroupId(groupId).size();
        if (members < MIN_MEMBERS) return "Awards need at least " + MIN_MEMBERS + " people in the group";
        if (expenses < MIN_EXPENSES) return "Awards unlock after " + MIN_EXPENSES + " expenses (" + expenses + " so far)";
        return null;
    }

    List<Award> compute(UUID groupId, Group group) {
        Map<UUID, String> names = memberRepository.findAllByGroupId(groupId).stream()
            .collect(Collectors.toMap(m -> m.getUser().getId(), m -> m.getUser().getFirstName(), (a, b) -> a, LinkedHashMap::new));
        List<Expense> expenses = expenseRepository.findActiveByGroupId(groupId);
        String currency = group.getCurrencyCode();
        List<Award> awards = new ArrayList<>();

        // 🍛 Biryani Baron: most paid on food (falls back to the single biggest bill)
        Map<UUID, Long> food = new HashMap<>();
        for (Expense e : expenses) {
            if (!"FOOD".equalsIgnoreCase(e.getCategory())) continue;
            for (ExpensePayer p : e.getPayers()) food.merge(p.getUser().getId(), p.getPaidCents(), Long::sum);
        }
        if (!food.isEmpty()) {
            top(food, names, 1).ifPresent(t -> awards.add(new Award("biryani-baron", "🍛", "Biryani Baron", t.names(),
                "Paid " + CurrencyUtil.formatCents(t.value(), currency) + " for food")));
        } else {
            expenses.stream().max(Comparator.comparingLong(Expense::getCostCents)).ifPresent(big -> {
                List<String> who = big.getPayers().stream().map(p -> names.getOrDefault(p.getUser().getId(), "Someone")).distinct().toList();
                awards.add(new Award("biryani-baron", "🍛", "Biryani Baron", who, "Biggest single bill: " + CurrencyUtil.formatCents(big.getCostCents(), currency)));
            });
        }

        // ☕ Chai Sponsor: most small rounds paid (cheaper than the group's median bill)
        List<Long> costs = expenses.stream().map(Expense::getCostCents).sorted().toList();
        long median = costs.get(costs.size() / 2);
        Map<UUID, Long> small = new HashMap<>();
        for (Expense e : expenses) {
            if (e.getCostCents() > median) continue;
            e.getPayers().stream().max(Comparator.comparingLong(ExpensePayer::getPaidCents))
                .ifPresent(p -> small.merge(p.getUser().getId(), 1L, Long::sum));
        }
        top(small, names, 2).ifPresent(t -> awards.add(new Award("chai-sponsor", "☕", "Chai Sponsor", t.names(), t.value() + " small rounds paid")));

        // ⚡ Fastest Payer: shortest average time from a shared expense to paying someone back
        Map<UUID, List<Long>> delays = new HashMap<>();
        for (Settlement s : settlementRepository.findByGroupId(groupId)) {
            UUID payer = s.getPayer().getId();
            expenses.stream()
                .filter(e -> !e.getCreatedAt().isAfter(s.getCreatedAt()) && e.getSplits().stream().anyMatch(sp -> sp.getUser().getId().equals(payer)))
                .map(Expense::getCreatedAt).max(Comparator.naturalOrder())
                .ifPresent(at -> delays.computeIfAbsent(payer, k -> new ArrayList<>()).add(Duration.between(at, s.getCreatedAt()).toMinutes()));
        }
        delays.entrySet().stream()
            .min(Comparator.comparingDouble(e -> e.getValue().stream().mapToLong(Long::longValue).average().orElse(Double.MAX_VALUE)))
            .ifPresent(e -> awards.add(new Award("fastest-payer", "⚡", "Fastest Payer", List.of(names.getOrDefault(e.getKey(), "Someone")), "Quickest to settle up")));

        // 👻 Ghost: still owes, and has owed the longest
        Map<UUID, Long> net = balanceService.netBalances(groupId);
        Map<UUID, Long> ageDays = new HashMap<>();
        for (Map.Entry<UUID, Long> n : net.entrySet()) {
            if (n.getValue() >= 0) continue;
            expenses.stream()
                .filter(e -> e.getSplits().stream().anyMatch(sp -> sp.getUser().getId().equals(n.getKey())))
                .map(Expense::getCreatedAt).min(Comparator.naturalOrder())
                .ifPresent(first -> ageDays.put(n.getKey(), Duration.between(first, Instant.now()).toDays()));
        }
        top(ageDays, names, 0).ifPresent(t -> awards.add(new Award("ghost", "👻", "Ghost of the Trip", t.names(), "Still has something to settle")));

        // 🧾 Receipt Hoarder: attached the most receipts
        Map<UUID, Long> receipts = new HashMap<>();
        for (Expense e : expenses) {
            if (e.hasReceipt() && e.getCreatedBy() != null) receipts.merge(e.getCreatedBy().getId(), 1L, Long::sum);
        }
        top(receipts, names, 1).ifPresent(t -> awards.add(new Award("receipt-hoarder", "🧾", "Receipt Hoarder", t.names(), t.value() + " receipts attached")));
        return awards;
    }

    private record Top(List<String> names, long value) {}

    /** Everyone tied for the highest value (at least `min`), as first names. */
    private static Optional<Top> top(Map<UUID, Long> values, Map<UUID, String> names, long min) {
        long max = values.values().stream().mapToLong(Long::longValue).max().orElse(0);
        if (values.isEmpty() || max < min || (min > 0 && max == 0)) return Optional.empty();
        List<String> winners = values.entrySet().stream().filter(e -> e.getValue() == max)
            .map(e -> names.getOrDefault(e.getKey(), "Someone")).sorted().toList();
        return Optional.of(new Top(winners, max));
    }
}
