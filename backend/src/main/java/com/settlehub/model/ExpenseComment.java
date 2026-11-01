package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "expense_comments")
public class ExpenseComment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "expense_id", nullable = false)
    private UUID expenseId;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(nullable = false, length = 400)
    private String body;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public ExpenseComment() {}
    public ExpenseComment(UUID expenseId, UUID userId, String body) {
        this.expenseId = expenseId;
        this.userId = userId;
        this.body = body;
    }
    public UUID getId() { return id; }
    public UUID getExpenseId() { return expenseId; }
    public UUID getUserId() { return userId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
