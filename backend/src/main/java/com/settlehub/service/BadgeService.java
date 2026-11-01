package com.settlehub.service;

import com.settlehub.dto.BadgeDto;
import com.settlehub.dto.GroupDto;
import com.settlehub.model.Group;
import com.settlehub.model.GroupMember;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.SettlementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Badges are computed from live data on every request; nothing is stored. */
@Service
public class BadgeService {

    private static final Duration INSTANT_WINDOW = Duration.ofHours(24);

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final BalanceService balanceService;

    public BadgeService(GroupRepository groupRepository, GroupMemberRepository groupMemberRepository,
                        ExpenseRepository expenseRepository, SettlementRepository settlementRepository,
                        BalanceService balanceService) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.balanceService = balanceService;
    }

    @Transactional(readOnly = true)
    public List<BadgeDto> badgesFor(UUID userId) {
        List<Group> groups = groupRepository.findAllForUser(userId).stream().filter(g -> !g.isArchived()).toList();
        boolean globetrotter = groups.stream().map(GroupDto::currencyOf).distinct().count() >= 2;
        boolean tripMvp = false;
        boolean zeroDebt = false;

        if (!groups.isEmpty()) {
            List<UUID> ids = groups.stream().map(Group::getId).toList();
            List<GroupMember> members = groupMemberRepository.findAllByGroupIdIn(ids);
            Map<UUID, Integer> memberCount = new HashMap<>();
            for (GroupMember m : members) memberCount.merge(m.getGroup().getId(), 1, Integer::sum);

            Map<UUID, Long> spend = balanceService.totalSpend(ids);
            Map<UUID, Long> paidByMe = new HashMap<>();
            for (Object[] row : expenseRepository.sumPaidByGroupAndUser(ids)) {
                if (userId.equals(row[1])) paidByMe.put((UUID) row[0], ((Number) row[2]).longValue());
            }
            // Needs a real group: with two people "paid more than half" says little
            tripMvp = ids.stream().anyMatch(id ->
                memberCount.getOrDefault(id, 0) >= 3
                    && spend.getOrDefault(id, 0L) > 0
                    && paidByMe.getOrDefault(id, 0L) * 2 > spend.get(id));

            Map<UUID, Map<UUID, Long>> nets = balanceService.netBalancesForGroups(ids, members);
            boolean allZero = ids.stream().allMatch(id -> nets.getOrDefault(id, Map.of()).getOrDefault(userId, 0L) == 0L);
            // A new user with nothing to settle hasn't earned this: they must have settled something
            zeroDebt = allZero && settlementRepository.countInvolving(userId, ids) > 0;
        }

        return List.of(
            new BadgeDto("instant-settler", "⚡", "Instant Settler", "Paid someone back within 24 hours of an expense", instantSettler(userId)),
            new BadgeDto("trip-mvp", "👑", "Trip MVP", "Paid for more than half of a group of 3 or more", tripMvp),
            new BadgeDto("zero-debt", "🤝", "Zero-Debt Master", "Fully settled up in every active group", zeroDebt),
            new BadgeDto("globetrotter", "🌍", "Globetrotter", "Active in groups with 2 or more currencies", globetrotter)
        );
    }

    private boolean instantSettler(UUID userId) {
        Map<UUID, List<Instant>> expenses = new HashMap<>();
        for (Object[] row : expenseRepository.splitExpenseTimes(userId)) {
            expenses.computeIfAbsent((UUID) row[0], k -> new ArrayList<>()).add((Instant) row[1]);
        }
        for (Object[] row : settlementRepository.payerSettlementTimes(userId)) {
            Instant paidAt = (Instant) row[1];
            for (Instant expenseAt : expenses.getOrDefault((UUID) row[0], List.of())) {
                if (!expenseAt.isAfter(paidAt) && Duration.between(expenseAt, paidAt).compareTo(INSTANT_WINDOW) <= 0) return true;
            }
        }
        return false;
    }
}
