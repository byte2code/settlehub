package com.settlehub.service;

import com.settlehub.dto.DebtRepaymentDto;
import com.settlehub.dto.GroupBalanceSummaryDto;
import com.settlehub.dto.GroupDto;
import com.settlehub.dto.UserPaymentSummaryDto;
import com.settlehub.dto.UserPaymentSummaryDto.GroupDebtDetailDto;
import com.settlehub.dto.UserPaymentSummaryDto.PersonPaymentDto;
import com.settlehub.engine.DebtSimplificationService;
import com.settlehub.model.*;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupRepository;
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
    private final GroupRepository groupRepository;

    public BalanceService(GroupMemberRepository groupMemberRepository,
                          ExpenseRepository expenseRepository,
                          SettlementRepository settlementRepository,
                          DebtSimplificationService debtSimplificationService,
                          GroupAccessService groupAccessService,
                          GroupRepository groupRepository) {
        this.groupMemberRepository = groupMemberRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.debtSimplificationService = debtSimplificationService;
        this.groupAccessService = groupAccessService;
        this.groupRepository = groupRepository;
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

    /**
     * Who the user owes / is owed across all their active groups, using each group's simplified debts.
     * A person who owes the user in one group and is owed by them in another appears in both lists
     * (debts are not netted across groups, as each group settles independently).
     */
    @Transactional(readOnly = true)
    public UserPaymentSummaryDto getUserPaymentSummary(UUID userId) {
        List<Group> groups = groupRepository.findAllForUser(userId).stream().filter(g -> !g.isArchived()).toList();
        if (groups.isEmpty()) {
            return new UserPaymentSummaryDto(Map.of(), Map.of(), List.of(), List.of());
        }
        List<UUID> groupIds = groups.stream().map(Group::getId).toList();
        List<GroupMember> members = groupMemberRepository.findAllByGroupIdIn(groupIds);
        Map<UUID, User> users = new HashMap<>();
        for (GroupMember m : members) users.put(m.getUser().getId(), m.getUser());
        Map<UUID, Map<UUID, Long>> nets = netBalancesForGroups(groupIds, members);

        // key: otherUserId|currency
        Map<String, PersonAcc> owe = new LinkedHashMap<>();
        Map<String, PersonAcc> owed = new LinkedHashMap<>();
        Map<String, Long> totalOwe = new TreeMap<>();
        Map<String, Long> totalOwed = new TreeMap<>();

        for (Group group : groups) {
            String currency = GroupDto.currencyOf(group);
            Map<UUID, Long> net = nets.getOrDefault(group.getId(), Map.of());
            for (DebtSimplificationService.DebtRepayment d : debtSimplificationService.simplifyNetBalances(net, currency)) {
                if (d.amountCents() <= 0) continue;
                boolean iPay = d.fromUserId().equals(userId);
                boolean iReceive = d.toUserId().equals(userId);
                if (!iPay && !iReceive) continue;
                UUID other = iPay ? d.toUserId() : d.fromUserId();
                (iPay ? owe : owed)
                    .computeIfAbsent(other + "|" + currency, k -> new PersonAcc(other, currency))
                    .add(group, d.amountCents());
                (iPay ? totalOwe : totalOwed).merge(currency, d.amountCents(), Long::sum);
            }
        }
        return new UserPaymentSummaryDto(totalOwe, totalOwed,
            toPeople(owe, users, true), toPeople(owed, users, false));
    }

    private static List<PersonPaymentDto> toPeople(Map<String, PersonAcc> accs, Map<UUID, User> users, boolean includeUpi) {
        return accs.values().stream()
            .map(a -> {
                User u = users.get(a.userId);
                return new PersonPaymentDto(
                    a.userId,
                    u != null ? u.getFullName() : "Former member",
                    includeUpi && u != null ? u.getUpiId() : null,
                    a.currency,
                    a.total,
                    a.groups.stream().sorted(Comparator.comparing(GroupDebtDetailDto::amountCents).reversed()).toList());
            })
            .sorted(Comparator.comparing(PersonPaymentDto::totalAmountCents).reversed())
            .toList();
    }

    private static final class PersonAcc {
        final UUID userId;
        final String currency;
        long total;
        final List<GroupDebtDetailDto> groups = new ArrayList<>();

        PersonAcc(UUID userId, String currency) { this.userId = userId; this.currency = currency; }

        void add(Group group, long cents) {
            total += cents;
            groups.add(new GroupDebtDetailDto(group.getId(), group.getName(), cents));
        }
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
