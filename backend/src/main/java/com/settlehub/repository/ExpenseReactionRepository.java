package com.settlehub.repository;

import com.settlehub.model.ExpenseReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpenseReactionRepository extends JpaRepository<ExpenseReaction, UUID> {
    List<ExpenseReaction> findByExpenseIdIn(Collection<UUID> expenseIds);
    List<ExpenseReaction> findByExpenseId(UUID expenseId);
    Optional<ExpenseReaction> findByExpenseIdAndUserIdAndEmoji(UUID expenseId, UUID userId, String emoji);
}
