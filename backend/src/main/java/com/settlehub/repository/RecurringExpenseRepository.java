package com.settlehub.repository;

import com.settlehub.model.RecurringExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, UUID> {
    List<RecurringExpense> findByGroupIdOrderByNextRunDateAsc(UUID groupId);
    long countByGroupIdAndActiveTrue(UUID groupId);
    List<RecurringExpense> findByGroupIdAndActiveTrueAndNextRunDateLessThanEqual(UUID groupId, LocalDate date);
    List<RecurringExpense> findByActiveTrueAndNextRunDateLessThanEqual(LocalDate date);
}
