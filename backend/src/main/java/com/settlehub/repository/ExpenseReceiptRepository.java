package com.settlehub.repository;

import com.settlehub.model.ExpenseReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface ExpenseReceiptRepository extends JpaRepository<ExpenseReceipt, UUID> {

    /** Total size (in characters) of all receipt images stored for one group. */
    @Query("SELECT COALESCE(SUM(LENGTH(r.dataUrl)), 0) FROM ExpenseReceipt r WHERE r.expenseId IN (SELECT e.id FROM Expense e WHERE e.group.id = :groupId)")
    long totalCharsForGroup(@Param("groupId") UUID groupId);

    @Modifying
    @Query("UPDATE Expense e SET e.hasReceipt = false WHERE e.id IN (SELECT r.expenseId FROM ExpenseReceipt r WHERE r.createdAt < :cutoff)")
    int clearReceiptFlagsOlderThan(@Param("cutoff") Instant cutoff);

    @Modifying
    @Query("DELETE FROM ExpenseReceipt r WHERE r.createdAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
