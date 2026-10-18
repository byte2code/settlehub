package com.settlehub.repository;

import com.settlehub.model.Expense;
import com.settlehub.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    @Query("SELECT e FROM Expense e WHERE e.group = :group AND e.deletedAt IS NULL ORDER BY e.date DESC, e.createdAt DESC")
    List<Expense> findAllActiveByGroup(@Param("group") Group group);
}
