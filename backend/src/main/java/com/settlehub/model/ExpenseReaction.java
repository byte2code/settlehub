package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "expense_reactions")
public class ExpenseReaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "expense_id", nullable = false)
    private UUID expenseId;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(nullable = false, length = 16)
    private String emoji;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public ExpenseReaction() {}
    public ExpenseReaction(UUID expenseId, UUID userId, String emoji) {
        this.expenseId = expenseId;
        this.userId = userId;
        this.emoji = emoji;
    }
    public UUID getId() { return id; }
    public UUID getExpenseId() { return expenseId; }
    public UUID getUserId() { return userId; }
    public String getEmoji() { return emoji; }
}
