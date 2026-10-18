package com.settlehub.service;

import com.settlehub.dto.DebtRepaymentDto;
import com.settlehub.dto.GroupBalanceSummaryDto;
import com.settlehub.engine.DebtSimplificationService;
import com.settlehub.model.*;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.SettlementRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class BalanceService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final DebtSimplificationService debtSimplificationService;

    public BalanceService(GroupRepository groupRepository,
                          GroupMemberRepository groupMemberRepository,
                          ExpenseRepository expenseRepository,
                          SettlementRepository settlementRepository,
                          DebtSimplificationService debtSimplificationService) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.debtSimplificationService = debtSimplificationService;
    }

    @Transactional(readOnly = true)
    public Map<UUID, Long> calculateGroupNetBalances(Group group) {
        List<GroupMember> members = groupMemberRepository.findAllByGroup(group);
        Map<UUID, Long> netBalances = new HashMap<>();

        // Initialize all members with 0 balance
        for (GroupMember member : members) {
            netBalances.put(member.getUser().getId(), 0L);
        }

        // Tally all active expenses in group (excluding payment records which are tallied via settlements)
        List<Expense> expenses = expenseRepository.findAllActiveByGroup(group);
        for (Expense expense : expenses) {
            if (expense.isPayment()) continue;

            // Add paid amounts to payers
            for (ExpensePayer payer : expense.getPayers()) {
                UUID payerId = payer.getUser().getId();
                netBalances.put(payerId, netBalances.getOrDefault(payerId, 0L) + payer.getPaidCents());
            }

            // Subtract owed amounts from split participants
            for (ExpenseSplit split : expense.getSplits()) {
                UUID debtorId = split.getUser().getId();
                netBalances.put(debtorId, netBalances.getOrDefault(debtorId, 0L) - split.getOwedCents());
            }
        }

        // Tally all settlements recorded directly
        List<Settlement> settlements = settlementRepository.findAllByGroupOrderByDateDesc(group);
        for (Settlement settlement : settlements) {
            UUID payerId = settlement.getPayer().getId();
            UUID payeeId = settlement.getPayee().getId();

            // Payer settled debt -> their balance increases (debt reduced)
            netBalances.put(payerId, netBalances.getOrDefault(payerId, 0L) + settlement.getAmountCents());
            // Payee received funds -> their credit reduces
            netBalances.put(payeeId, netBalances.getOrDefault(payeeId, 0L) - settlement.getAmountCents());
        }

        return netBalances;
    }

    @Transactional(readOnly = true)
    public GroupBalanceSummaryDto getGroupBalanceSummary(UUID groupId) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));

        List<GroupMember> members = groupMemberRepository.findAllByGroup(group);
        Map<UUID, String> userNames = new HashMap<>();
        for (GroupMember m : members) {
            userNames.put(m.getUser().getId(), m.getUser().getFullName());
        }

        Map<UUID, Long> netBalances = calculateGroupNetBalances(group);

        // Calculate pairwise direct (unsimplified) debts
        Map<String, Long> pairwiseDebts = new HashMap<>();
        List<Expense> expenses = expenseRepository.findAllActiveByGroup(group);

        for (Expense expense : expenses) {
            if (expense.isPayment()) continue;
            long totalCost = expense.getCostCents();
            if (totalCost <= 0) continue;

            for (ExpensePayer payer : expense.getPayers()) {
                UUID payerId = payer.getUser().getId();
                long paid = payer.getPaidCents();
                if (paid <= 0) continue;

                double payerContributionRatio = (double) paid / totalCost;

                for (ExpenseSplit split : expense.getSplits()) {
                    UUID debtorId = split.getUser().getId();
                    if (debtorId.equals(payerId)) continue;

                    long splitOwed = split.getOwedCents();
                    long debtorShareToThisPayer = Math.round(splitOwed * payerContributionRatio);

                    if (debtorShareToThisPayer > 0) {
                        String key = debtorId + "->" + payerId;
                        pairwiseDebts.put(key, pairwiseDebts.getOrDefault(key, 0L) + debtorShareToThisPayer);
                    }
                }
            }
        }

        // Account for settlements in pairwise debts
        List<Settlement> settlements = settlementRepository.findAllByGroupOrderByDateDesc(group);
        for (Settlement settlement : settlements) {
            UUID payerId = settlement.getPayer().getId();
            UUID payeeId = settlement.getPayee().getId();
            String key = payerId + "->" + payeeId;
            long current = pairwiseDebts.getOrDefault(key, 0L);
            pairwiseDebts.put(key, Math.max(0L, current - settlement.getAmountCents()));
        }

        String groupCurrency = (group.getCurrencyCode() != null && !group.getCurrencyCode().isBlank())
            ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;

        List<DebtSimplificationService.DebtRepayment> rawOriginal =
            debtSimplificationService.computePairwiseDebts(pairwiseDebts, groupCurrency);

        List<DebtSimplificationService.DebtRepayment> rawSimplified =
            debtSimplificationService.simplifyNetBalances(netBalances, groupCurrency);

        List<DebtRepaymentDto> originalDebts = rawOriginal.stream()
            .map(d -> new DebtRepaymentDto(
                d.fromUserId(),
                userNames.getOrDefault(d.fromUserId(), "Unknown"),
                d.toUserId(),
                userNames.getOrDefault(d.toUserId(), "Unknown"),
                d.amountCents(),
                CurrencyUtil.formatCents(d.amountCents(), d.currencyCode()),
                d.currencyCode()
            ))
            .toList();

        List<DebtRepaymentDto> simplifiedDebts = rawSimplified.stream()
            .map(d -> new DebtRepaymentDto(
                d.fromUserId(),
                userNames.getOrDefault(d.fromUserId(), "Unknown"),
                d.toUserId(),
                userNames.getOrDefault(d.toUserId(), "Unknown"),
                d.amountCents(),
                CurrencyUtil.formatCents(d.amountCents(), d.currencyCode()),
                d.currencyCode()
            ))
            .toList();

        int savedTransactions = Math.max(0, originalDebts.size() - simplifiedDebts.size());

        Map<UUID, String> formattedNet = new HashMap<>();
        for (Map.Entry<UUID, Long> entry : netBalances.entrySet()) {
            long bal = entry.getValue();
            String f = CurrencyUtil.formatCents(bal, groupCurrency);
            formattedNet.put(entry.getKey(), f);
        }

        return new GroupBalanceSummaryDto(
            group.getId(),
            group.getName(),
            group.isSimplifyByDefault(),
            simplifiedDebts,
            originalDebts,
            savedTransactions,
            netBalances,
            formattedNet
        );
    }
}
