package com.settlehub.repository;

import com.settlehub.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    /**
     * Active (not deleted) real expenses of a group, newest first.
     * Legacy 2.0 "payment" expenses are excluded; settlements are the source of truth for payments.
     */
    @Query("""
        SELECT e FROM Expense e
        WHERE e.group.id = :groupId AND e.deletedAt IS NULL AND e.isPayment = false
        ORDER BY e.date DESC, e.createdAt DESC
        """)
    List<Expense> findActiveByGroupId(@Param("groupId") UUID groupId);

    /** Rows of [groupId, userId, sum(paidCents)] for active expenses. */
    @Query("""
        SELECT e.group.id, p.user.id, SUM(p.paidCents) FROM ExpensePayer p JOIN p.expense e
        WHERE e.group.id IN :groupIds AND e.deletedAt IS NULL AND e.isPayment = false
        GROUP BY e.group.id, p.user.id
        """)
    List<Object[]> sumPaidByGroupAndUser(@Param("groupIds") Collection<UUID> groupIds);

    /** Rows of [groupId, userId, sum(owedCents)] for active expenses. */
    @Query("""
        SELECT e.group.id, s.user.id, SUM(s.owedCents) FROM ExpenseSplit s JOIN s.expense e
        WHERE e.group.id IN :groupIds AND e.deletedAt IS NULL AND e.isPayment = false
        GROUP BY e.group.id, s.user.id
        """)
    List<Object[]> sumOwedByGroupAndUser(@Param("groupIds") Collection<UUID> groupIds);

    /** Rows of [groupId, sum(costCents)] for active expenses. */
    @Query("""
        SELECT e.group.id, SUM(e.costCents) FROM Expense e
        WHERE e.group.id IN :groupIds AND e.deletedAt IS NULL AND e.isPayment = false
        GROUP BY e.group.id
        """)
    List<Object[]> sumSpendByGroup(@Param("groupIds") Collection<UUID> groupIds);

    @Query("SELECT COUNT(e) > 0 FROM Expense e WHERE e.group.id = :groupId AND e.deletedAt IS NULL AND e.isPayment = false")
    boolean existsActiveByGroupId(@Param("groupId") UUID groupId);
}
