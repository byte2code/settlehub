package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "expenses", indexes = {
    @Index(name = "idx_expense_group", columnList = "group_id"),
    @Index(name = "idx_expense_date", columnList = "date")
})
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private Long costCents; // Cent precision (e.g. 1000 = $10.00)

    @Column(nullable = false)
    private String currencyCode = "INR";

    @Column(nullable = false)
    private Instant date = Instant.now();

    @Column(nullable = false)
    private String creationMethod = "EQUAL"; // "EQUAL", "EXACT", "PERCENT", "PAYMENT"

    @Column(nullable = false)
    private boolean isPayment = false;

    @Column(name = "category")
    private String category = "OTHER"; // "FOOD", "TRANSPORT", "STAY", "ENTERTAINMENT", "SHOPPING", "OTHER"

    @Column(name = "receipt_url", columnDefinition = "TEXT")
    private String receiptUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @OneToMany(mappedBy = "expense", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExpensePayer> payers = new ArrayList<>();

    @OneToMany(mappedBy = "expense", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExpenseSplit> splits = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    private Instant deletedAt; // Soft-delete support

    public Expense() {}

    public Expense(Group group, String description, Long costCents, String currencyCode,
                   Instant date, String creationMethod, boolean isPayment, User createdBy) {
        this.group = group;
        this.description = description;
        this.costCents = costCents;
        this.currencyCode = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode.trim().toUpperCase() : "INR";
        this.date = (date != null) ? date : Instant.now();
        this.creationMethod = (creationMethod != null) ? creationMethod : "EQUAL";
        this.isPayment = isPayment;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Long getCostCents() { return costCents; }
    public void setCostCents(Long costCents) { this.costCents = costCents; }

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }

    public Instant getDate() { return date; }
    public void setDate(Instant date) { this.date = date; }

    public String getCreationMethod() { return creationMethod; }
    public void setCreationMethod(String creationMethod) { this.creationMethod = creationMethod; }

    public boolean isPayment() { return isPayment; }
    public void setPayment(boolean payment) { isPayment = payment; }

    public String getCategory() { return category != null ? category : "OTHER"; }
    public void setCategory(String category) { this.category = category != null ? category.trim().toUpperCase() : "OTHER"; }

    public String getReceiptUrl() { return receiptUrl; }
    public void setReceiptUrl(String receiptUrl) { this.receiptUrl = receiptUrl; }

    public User getCreatedBy() { return createdBy; }
    public void setCreatedBy(User createdBy) { this.createdBy = createdBy; }

    public List<ExpensePayer> getPayers() { return payers; }
    public void setPayers(List<ExpensePayer> payers) { this.payers = payers; }

    public List<ExpenseSplit> getSplits() { return splits; }
    public void setSplits(List<ExpenseSplit> splits) { this.splits = splits; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }

    public boolean isDeleted() { return deletedAt != null; }

    public void addPayer(User user, Long paidCents) {
        ExpensePayer payer = new ExpensePayer(this, user, paidCents);
        this.payers.add(payer);
    }

    public void addSplit(User user, Long owedCents) {
        ExpenseSplit split = new ExpenseSplit(this, user, owedCents);
        this.splits.add(split);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Expense expense)) return false;
        return Objects.equals(id, expense.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
