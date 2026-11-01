package com.settlehub.repository;

import com.settlehub.model.ExpenseComment;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseCommentRepository extends JpaRepository<ExpenseComment, UUID> {
    List<ExpenseComment> findByExpenseIdOrderByCreatedAtAsc(UUID expenseId, Pageable pageable);

    long countByExpenseId(UUID expenseId);

    /** Rows of [expenseId, count]. */
    @Query("SELECT c.expenseId, COUNT(c) FROM ExpenseComment c WHERE c.expenseId IN :ids GROUP BY c.expenseId")
    List<Object[]> countByExpenseIds(@Param("ids") Collection<UUID> ids);
}
