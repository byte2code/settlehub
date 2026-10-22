package com.settlehub.service;

import com.settlehub.dto.DebtRepaymentDto;
import com.settlehub.dto.GroupBalanceSummaryDto;
import com.settlehub.dto.GroupDto;
import com.settlehub.engine.DebtSimplificationService;
import com.settlehub.model.*;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.SettlementRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Net balance of a member = paid for expenses - owed on expenses + settlements paid - settlements received.
 * Positive means the group owes them money.
 *
 * Balances for many groups are computed with a handful of aggregate queries, independent of the
 * number of groups or expenses.
 */
@Service
public class BalanceService {

    private final GroupMemberRepository groupMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final DebtSimplificationService debtSimplificationService;
    private final GroupAccessService groupAccessService;

    public BalanceService(GroupMemberRepository groupMemberRepository,
                          ExpenseRepository expenseRepository,
                          SettlementRepository settlementRepository,
                          DebtSimplificationService debtSimplificationService,
                          GroupAccessService groupAccessService) {
        this.groupMemberRepository = groupMemberRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.debtSimplificationService = debtSimplificationService;
        this.groupAccessService = groupAccessService;
    }

    /** groupId -> (userId -> net balance cents). Members of the groups appear even with a zero balance. */
    @Transactional(readOnly = true)
    public Map<UUID, Map<UUID, Long>> netBalancesForGroups(Collection<UUID> groupIds, List<GroupMember> members) {
        Map<UUID, Map<UUID, Long>> result = new HashMap<>();
        if (groupIds.isEmpty()) return result;

        for (GroupMember m : members) {
            result.computeIfAbsent(m.getGroup().getId(), k -> new LinkedHashMap<>()).put(m.getUser().getId(), 0L);
        }
        addRows(result, expenseRepository.sumPaidByGroupAndUser(groupIds), 1);
        addRows(result, expenseRepository.sumOwedByGroupAndUser(groupIds), -1);
        addRows(result, settlementRepository.sumPaidByGroupAndPayer(groupIds), 1);
        addRows(result, settlementRepository.sumReceivedByGroupAndPayee(groupIds), -1);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> netBalances(UUID groupId) {
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(groupId);
        return netBalancesForGroups(List.of(groupId), members).getOrDefault(groupId, new LinkedHashMap<>());
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> totalSpend(Collection<UUID> groupIds) {
        Map<UUID, Long> result = new HashMap<>();
        if (groupIds.isEmpty()) return result;
        for (Object[] row : expenseRepository.sumSpendByGroup(groupIds)) {
            result.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return result;
    }

    private static void addRows(Map<UUID, Map<UUID, Long>> target, List<Object[]> rows, int sign) {
        for (Object[] row : rows) {
            UUID groupId = (UUID) row[0];
            UUID userId = (UUID) row[1];
            long amount = ((Number) row[2]).longValue() * sign;
            target.computeIfAbsent(groupId, k -> new LinkedHashMap<>()).merge(userId, amount, Long::sum);
        }
    }

    @Transactional(readOnly = true)
    public GroupBalanceSummaryDto getGroupBalanceSummary(UUID groupId, UUID currentUserId) {
        Group group = groupAccessService.requireGroup(groupId, currentUserId);
        String currency = GroupDto.currencyOf(group);

        List<GroupMember> members = groupMemberRepository.findAllByGroupId(groupId);
        Map<UUID, String> userNames = new HashMap<>();
        for (GroupMember m : members) {
            userNames.put(m.getUser().getId(), m.getUser().getFullName());
        }

        Map<UUID, Long> netBalances = netBalancesForGroups(List.of(groupId), members)
            .getOrDefault(groupId, new LinkedHashMap<>());

        // Direct (unsimplified) debts: each debtor owes each payer in proportion to what that payer paid.
        Map<String, Long> pairwiseDebts = new HashMap<>();
        for (Expense expense : expenseRepository.findActiveByGroupId(groupId)) {
            long totalCost = expense.getCostCents();
            if (totalCost <= 0) continue;
            for (ExpensePayer payer : expense.getPayers()) {
                UUID payerId = payer.getUser().getId();
                userNames.putIfAbsent(payerId, payer.getUser().getFullName());
                if (payer.getPaidCents() <= 0) continue;
                for (ExpenseSplit split : expense.getSplits()) {
                    UUID debtorId = split.getUser().getId();
                    userNames.putIfAbsent(debtorId, split.getUser().getFullName());
                    if (debtorId.equals(payerId)) continue;
                    long share = Math.round((double) split.getOwedCents() * payer.getPaidCents() / totalCost);
                    if (share > 0) {
                        pairwiseDebts.merge(debtorId + "->" + payerId, share, Long::sum);
                    }
                }
            }
        }
        for (Settlement settlement : settlementRepository.findByGroupId(groupId)) {
            // A payment from payer to payee reduces what payer owes payee (or creates a reverse debt).
            pairwiseDebts.merge(settlement.getPayee().getId() + "->" + settlement.getPayer().getId(),
                settlement.getAmountCents(), Long::sum);
        }

        List<DebtRepaymentDto> originalDebts = toDtos(debtSimplificationService.computePairwiseDebts(pairwiseDebts, currency), userNames);
        List<DebtRepaymentDto> simplifiedDebts = toDtos(debtSimplificationService.simplifyNetBalances(netBalances, currency), userNames);

        Map<UUID, String> formattedNet = new LinkedHashMap<>();
        netBalances.forEach((userId, cents) -> formattedNet.put(userId, CurrencyUtil.formatCents(cents, currency)));

        return new GroupBalanceSummaryDto(
            group.getId(),
            group.getName(),
            group.isSimplifyByDefault(),
            simplifiedDebts,
            originalDebts,
            Math.max(0, originalDebts.size() - simplifiedDebts.size()),
            netBalances,
            formattedNet
        );
    }

    private static List<DebtRepaymentDto> toDtos(List<DebtSimplificationService.DebtRepayment> debts, Map<UUID, String> names) {
        return debts.stream()
            .map(d -> new DebtRepaymentDto(
                d.fromUserId(),
                names.getOrDefault(d.fromUserId(), "Former member"),
                d.toUserId(),
                names.getOrDefault(d.toUserId(), "Former member"),
                d.amountCents(),
                CurrencyUtil.formatCents(d.amountCents(), d.currencyCode()),
                d.currencyCode()
            ))
            .sorted(Comparator.comparing(DebtRepaymentDto::amountCents).reversed())
            .toList();
    }
}
