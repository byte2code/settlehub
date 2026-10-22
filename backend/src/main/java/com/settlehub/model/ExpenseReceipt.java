package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/**
 * Receipt photo for an expense, stored as a compressed image data URL.
 * Kept out of the expenses table so expense lists never load image bytes.
 */
@Entity
@Table(name = "expense_receipts")
public class ExpenseReceipt {

    @Id
    @Column(name = "expense_id")
    private UUID expenseId;

    @Column(name = "data_url", nullable = false, columnDefinition = "TEXT")
    private String dataUrl;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public ExpenseReceipt() {}

    public ExpenseReceipt(UUID expenseId, String dataUrl) {
        this.expenseId = expenseId;
        this.dataUrl = dataUrl;
        this.createdAt = Instant.now();
    }

    public UUID getExpenseId() { return expenseId; }
    public String getDataUrl() { return dataUrl; }
    public void setDataUrl(String dataUrl) { this.dataUrl = dataUrl; }
    public Instant getCreatedAt() { return createdAt; }
}
