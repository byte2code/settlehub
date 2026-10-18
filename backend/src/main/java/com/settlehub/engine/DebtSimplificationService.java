package com.settlehub.engine;

import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * DebtSimplificationService implementing the dual Max-Heap Min-Cash-Flow algorithm (O(N log N)).
 *
 * Mathematical Foundation:
 * Given a set of N participants with net balances B_i such that sum(B_i) = 0:
 * - Net Creditors (B_i > 0) are ordered in a descending Max-Heap.
 * - Net Debtors (|B_i| for B_i < 0) are ordered in a descending Max-Heap.
 *
 * In each step, the largest debtor is paired with the largest creditor.
 * The transaction resolves at least one participant's complete balance, guaranteeing
 * convergence in at most N - 1 transactions and completely eliminating debt cycles.
 */
@Service
public class DebtSimplificationService {

    public record PersonBalance(UUID userId, long amountCents) {}

    public record DebtRepayment(UUID fromUserId, UUID toUserId, long amountCents, String currencyCode) {}

    public record SimplificationResult(
        List<DebtRepayment> simplifiedDebts,
        List<DebtRepayment> originalDebts,
        int savedTransactionsCount,
        Map<UUID, Long> netBalances
    ) {}

    /**
     * Executes debt simplification from a pre-computed map of net balances.
     */
    public List<DebtRepayment> simplifyNetBalances(Map<UUID, Long> netBalances, String currencyCode) {
        if (netBalances == null || netBalances.isEmpty()) {
            return Collections.emptyList();
        }

        String currency = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode : CurrencyUtil.DEFAULT_CURRENCY;

        // Max-Heaps for Creditors (positive balance) and Debtors (absolute negative balance)
        PriorityQueue<PersonBalance> creditors = new PriorityQueue<>((a, b) -> Long.compare(b.amountCents(), a.amountCents()));
        PriorityQueue<PersonBalance> debtors = new PriorityQueue<>((a, b) -> Long.compare(b.amountCents(), a.amountCents()));

        for (Map.Entry<UUID, Long> entry : netBalances.entrySet()) {
            long balance = entry.getValue();
            if (balance > 0) {
                creditors.add(new PersonBalance(entry.getKey(), balance));
            } else if (balance < 0) {
                debtors.add(new PersonBalance(entry.getKey(), Math.abs(balance)));
            }
        }

        List<DebtRepayment> result = new ArrayList<>();

        while (!debtors.isEmpty() && !creditors.isEmpty()) {
            PersonBalance maxDebtor = debtors.poll();
            PersonBalance maxCreditor = creditors.poll();

            long settleAmount = Math.min(maxDebtor.amountCents(), maxCreditor.amountCents());

            if (settleAmount > 0) {
                result.add(new DebtRepayment(maxDebtor.userId(), maxCreditor.userId(), settleAmount, currency));
            }

            long debtorRemaining = maxDebtor.amountCents() - settleAmount;
            long creditorRemaining = maxCreditor.amountCents() - settleAmount;

            if (debtorRemaining > 0) {
                debtors.add(new PersonBalance(maxDebtor.userId(), debtorRemaining));
            }
            if (creditorRemaining > 0) {
                creditors.add(new PersonBalance(maxCreditor.userId(), creditorRemaining));
            }
        }

        return result;
    }

    /**
     * Computes pairwise (unsimplified) directed debts between users.
     */
    public List<DebtRepayment> computePairwiseDebts(Map<String, Long> directedDebts, String currencyCode) {
        if (directedDebts == null || directedDebts.isEmpty()) {
            return Collections.emptyList();
        }

        String currency = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode : CurrencyUtil.DEFAULT_CURRENCY;
        Map<String, Long> netted = new HashMap<>();
        Set<String> processedPairs = new HashSet<>();

        for (Map.Entry<String, Long> entry : directedDebts.entrySet()) {
            String key = entry.getKey();
            String[] parts = key.split("->");
            if (parts.length != 2) continue;

            UUID u1 = UUID.fromString(parts[0]);
            UUID u2 = UUID.fromString(parts[1]);

            String pairKey = u1.compareTo(u2) < 0 ? (u1 + "<>" + u2) : (u2 + "<>" + u1);
            if (processedPairs.contains(pairKey)) continue;
            processedPairs.add(pairKey);

            long u1ToU2 = directedDebts.getOrDefault(u1 + "->" + u2, 0L);
            long u2ToU1 = directedDebts.getOrDefault(u2 + "->" + u1, 0L);

            long net = u1ToU2 - u2ToU1;
            if (net > 0) {
                netted.put(u1 + "->" + u2, net);
            } else if (net < 0) {
                netted.put(u2 + "->" + u1, Math.abs(net));
            }
        }

        List<DebtRepayment> list = new ArrayList<>();
        for (Map.Entry<String, Long> entry : netted.entrySet()) {
            String[] parts = entry.getKey().split("->");
            list.add(new DebtRepayment(UUID.fromString(parts[0]), UUID.fromString(parts[1]), entry.getValue(), currency));
        }

        return list;
    }
}
