package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "expense_groups")
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String groupType = "other"; // e.g. "trip", "home", "couple", "other"

    @Column(nullable = false)
    private boolean simplifyByDefault = true;

    @Column(nullable = false)
    private String currencyCode = "INR";

    @Column(unique = true, length = 16)
    private String inviteCode;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<GroupMember> members = new ArrayList<>();

    @OneToMany(mappedBy = "group", cascade = CascadeType.ALL)
    private List<Expense> expenses = new ArrayList<>();

    public Group() {
        this.inviteCode = generateInviteCode();
    }

    public Group(String name, String groupType, boolean simplifyByDefault) {
        this(name, groupType, simplifyByDefault, "INR");
    }

    public Group(String name, String groupType, boolean simplifyByDefault, String currencyCode) {
        this.name = name;
        this.groupType = (groupType != null && !groupType.isBlank()) ? groupType : "other";
        this.simplifyByDefault = simplifyByDefault;
        this.currencyCode = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode.trim().toUpperCase() : "INR";
        this.inviteCode = generateInviteCode();
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    public void onPrePersist() {
        if (this.createdAt == null) this.createdAt = Instant.now();
        if (this.updatedAt == null) this.updatedAt = Instant.now();
        if (this.inviteCode == null || this.inviteCode.isBlank()) {
            this.inviteCode = generateInviteCode();
        }
    }

    public static String generateInviteCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        java.security.SecureRandom random = new java.security.SecureRandom();
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getGroupType() { return groupType; }
    public void setGroupType(String groupType) { this.groupType = groupType; }

    public boolean isSimplifyByDefault() { return simplifyByDefault; }
    public void setSimplifyByDefault(boolean simplifyByDefault) { this.simplifyByDefault = simplifyByDefault; }

    public String getCurrencyCode() { return currencyCode; }
    public void setCurrencyCode(String currencyCode) {
        this.currencyCode = (currencyCode != null && !currencyCode.isBlank()) ? currencyCode.trim().toUpperCase() : "INR";
    }

    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public List<GroupMember> getMembers() { return members; }
    public void setMembers(List<GroupMember> members) { this.members = members; }

    public List<Expense> getExpenses() { return expenses; }
    public void setExpenses(List<Expense> expenses) { this.expenses = expenses; }

    public void addMember(User user, String role) {
        GroupMember member = new GroupMember(this, user, role);
        this.members.add(member);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Group group)) return false;
        return Objects.equals(id, group.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
