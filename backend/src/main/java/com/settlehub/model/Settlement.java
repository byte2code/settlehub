package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "settlements", indexes = {
    @Index(name = "idx_settlement_group", columnList = "group_id"),
    @Index(name = "idx_settlement_payer", columnList = "payer_id"),
    @Index(name = "idx_settlement_payee", columnList = "payee_id")
})
public class Settlement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payer_id", nullable = false)
    private User payer; // Debtor paying back

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payee_id", nullable = false)
    private User payee; // Creditor receiving payment

    @Column(nullable = false)
    private Long amountCents;

    @Column(nullable = false)
    private String currencyCode = "INR";

    @Column(nullable = false)
    private Instant date = Instant.now();

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Settlement() {}

    public Settlement(Group group, User payer, User payee, Long amountCents, String currencyCode, Instant date) {
        this.group = group;
        this.payer = payer;
        this.payee = payee;
        this.amountCents = amountCents;
        this.currencyCode = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode.trim().toUpperCase() : "INR";
        this.date = (date != null) ? date : Instant.now();
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public User getPayer() { return payer; }
    public void setPayer(User payer) { this.payer = payer; }

    public User getPayee() { return payee; }
    public void setPayee(User payee) { this.payee = payee; }

    public Long getAmountCents() { return amountCents; }
    public void setAmountCents(Long amountCents) { this.amountCents = amountCents; }

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) { this.currencyCode = currencyCode; }

    public Instant getDate() { return date; }
    public void setDate(Instant date) { this.date = date; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Settlement that)) return false;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
