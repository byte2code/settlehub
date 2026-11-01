package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "recurring_expenses")
public class RecurringExpense {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "group_id", nullable = false)
    private UUID groupId;
    @Column(name = "created_by_id", nullable = false)
    private UUID createdById;
    @Column(nullable = false, length = 140)
    private String description;
    @Column(name = "cost_cents", nullable = false)
    private Long costCents;
    @Column(nullable = false, length = 20)
    private String category = "OTHER";
    @Column(name = "payer_id", nullable = false)
    private UUID payerId;
    /** Comma separated member ids who share the cost equally. */
    @Column(nullable = false, length = 2000)
    private String participants;
    @Column(nullable = false, length = 10)
    private String frequency;
    @Column(name = "day_of_month", nullable = false)
    private int dayOfMonth;
    @Column(name = "next_run_date", nullable = false)
    private LocalDate nextRunDate;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "paused_reason", length = 120)
    private String pausedReason;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public RecurringExpense() {}

    public UUID getId() { return id; }
    public UUID getGroupId() { return groupId; }
    public void setGroupId(UUID v) { this.groupId = v; }
    public UUID getCreatedById() { return createdById; }
    public void setCreatedById(UUID v) { this.createdById = v; }
    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }
    public Long getCostCents() { return costCents; }
    public void setCostCents(Long v) { this.costCents = v; }
    public String getCategory() { return category; }
    public void setCategory(String v) { this.category = v; }
    public UUID getPayerId() { return payerId; }
    public void setPayerId(UUID v) { this.payerId = v; }
    public String getParticipants() { return participants; }
    public void setParticipants(String v) { this.participants = v; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String v) { this.frequency = v; }
    public int getDayOfMonth() { return dayOfMonth; }
    public void setDayOfMonth(int v) { this.dayOfMonth = v; }
    public LocalDate getNextRunDate() { return nextRunDate; }
    public void setNextRunDate(LocalDate v) { this.nextRunDate = v; }
    public boolean isActive() { return active; }
    public void setActive(boolean v) { this.active = v; }
    public String getPausedReason() { return pausedReason; }
    public void setPausedReason(String v) { this.pausedReason = v; }
    public Instant getCreatedAt() { return createdAt; }
}
