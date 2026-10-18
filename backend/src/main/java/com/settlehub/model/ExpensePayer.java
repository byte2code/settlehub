package com.settlehub.model;

import jakarta.persistence.*;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "expense_payers", indexes = {
    @Index(name = "idx_expense_payer_expense", columnList = "expense_id"),
    @Index(name = "idx_expense_payer_user", columnList = "user_id")
})
public class ExpensePayer {

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
    private Long paidCents;

    public ExpensePayer() {}

    public ExpensePayer(Expense expense, User user, Long paidCents) {
        this.expense = expense;
        this.user = user;
        this.paidCents = paidCents != null ? paidCents : 0L;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Expense getExpense() { return expense; }
    public void setExpense(Expense expense) { this.expense = expense; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Long getPaidCents() { return paidCents; }
    public void setPaidCents(Long paidCents) { this.paidCents = paidCents; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ExpensePayer that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
