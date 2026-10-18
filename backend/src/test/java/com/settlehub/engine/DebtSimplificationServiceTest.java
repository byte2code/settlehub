package com.settlehub.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class DebtSimplificationServiceTest {

    private final DebtSimplificationService service = new DebtSimplificationService();

    @Test
    @DisplayName("Circular debt (A->B, B->C, C->A of equal amounts) simplifies to 0 transactions")
    void testCircularDebtSimplification() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        // A owes B $20, B owes C $20, C owes A $20
        // Net balance for all 3 is $0
        Map<UUID, Long> netBalances = Map.of(
            a, 0L,
            b, 0L,
            c, 0L
        );

        List<DebtSimplificationService.DebtRepayment> simplified =
            service.simplifyNetBalances(netBalances, "USD");

        assertTrue(simplified.isEmpty(), "Circular balanced debt should require 0 transactions");
    }

    @Test
    @DisplayName("Transitive debt (A owes B $50, B owes C $50) simplifies to 1 direct transaction (A owes C $50)")
    void testTransitiveDebtSimplification() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        // A owes B $50 (-50), B owes C $50 (+50 - 50 = 0), C is owed $50 (+50)
        Map<UUID, Long> netBalances = Map.of(
            a, -5000L,
            b, 0L,
            c, 5000L
        );

        List<DebtSimplificationService.DebtRepayment> simplified =
            service.simplifyNetBalances(netBalances, "USD");

        assertEquals(1, simplified.size());
        DebtSimplificationService.DebtRepayment repayment = simplified.get(0);
        assertEquals(a, repayment.fromUserId());
        assertEquals(c, repayment.toUserId());
        assertEquals(5000L, repayment.amountCents());
    }

    @Test
    @DisplayName("4-Party debt graph simplifies with conservation of money and at most N-1 transactions")
    void testMultiPartyDebtSimplification() {
        UUID alice = UUID.randomUUID();
        UUID bob = UUID.randomUUID();
        UUID charlie = UUID.randomUUID();
        UUID david = UUID.randomUUID();

        // Realistic scenario:
        // Alice paid $100 for all 4 ($25 each) -> Alice net: +75, Bob: -25, Charlie: -25, David: -25
        // Bob paid $40 for Bob & Charlie ($20 each) -> Bob: +20, Charlie: -20
        // Charlie paid $60 for Charlie & David ($30 each) -> Charlie: +30, David: -30
        //
        // Net Balances:
        // Alice: +7500c ($75.00)
        // Bob: -2500c + 2000c = -500c (-$5.00)
        // Charlie: -2500c - 2000c + 3000c = -1500c (-$15.00)
        // David: -2500c - 3000c = -5500c (-$55.00)
        //
        // Check conservation: +7500 - 500 - 1500 - 5500 = 0.
        Map<UUID, Long> netBalances = Map.of(
            alice, 7500L,
            bob, -500L,
            charlie, -1500L,
            david, -5500L
        );

        List<DebtSimplificationService.DebtRepayment> simplified =
            service.simplifyNetBalances(netBalances, "USD");

        // Maximum possible transactions in a 4-person graph is 4 - 1 = 3
        assertTrue(simplified.size() <= 3, "Transactions count must be <= N - 1");

        // Verify all debts flow to Alice who is the only creditor
        for (DebtSimplificationService.DebtRepayment rep : simplified) {
            assertEquals(alice, rep.toUserId(), "Alice is the only net creditor and must receive all funds");
        }

        // Verify total settled amount strictly equals Alice's credit
        long totalSettled = simplified.stream().mapToLong(DebtSimplificationService.DebtRepayment::amountCents).sum();
        assertEquals(7500L, totalSettled);
    }
}
