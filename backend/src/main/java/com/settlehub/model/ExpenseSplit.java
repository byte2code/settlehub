package com.settlehub.model;

import jakarta.persistence.*;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "expense_splits", indexes = {
    @Index(name = "idx_expense_split_expense", columnList = "expense_id"),
    @Index(name = "idx_expense_split_user", columnList = "user_id")
})
public class ExpenseSplit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "expense_id", nullable = false)
    private Expense expense;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Long owedCents;

    public ExpenseSplit() {}

    public ExpenseSplit(Expense expense, User user, Long owedCents) {
        this.expense = expense;
        this.user = user;
        this.owedCents = owedCents != null ? owedCents : 0L;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Expense getExpense() { return expense; }
    public void setExpense(Expense expense) { this.expense = expense; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Long getOwedCents() { return owedCents; }
    public void setOwedCents(Long owedCents) { this.owedCents = owedCents; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ExpenseSplit that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
