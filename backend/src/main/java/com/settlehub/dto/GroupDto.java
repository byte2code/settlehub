package com.settlehub.dto;

import com.settlehub.model.Group;
import com.settlehub.util.CurrencyUtil;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GroupDto(
    UUID id,
    String name,
    String groupType,
    boolean simplifyByDefault,
    String currencyCode,
    String inviteCode,
    boolean archived,
    Long budgetCents,
    String budgetFormatted,
    Instant createdAt,
    Instant updatedAt,
    List<GroupMemberDto> members,
    Long userNetBalanceCents,
    String userNetBalanceFormatted,
    long totalSpendCents,
    String totalSpendFormatted,
    String myRole
) {
    public static GroupDto fromEntity(Group group, List<GroupMemberDto> members, long userNetBalanceCents,
                                      long totalSpendCents, String myRole) {
        String currency = currencyOf(group);
        return new GroupDto(
            group.getId(),
            group.getName(),
            group.getGroupType(),
            group.isSimplifyByDefault(),
            currency,
            group.getInviteCode(),
            group.isArchived(),
            group.getBudgetCents(),
            group.getBudgetCents() != null ? CurrencyUtil.formatCents(group.getBudgetCents(), currency) : null,
            group.getCreatedAt(),
            group.getUpdatedAt(),
            members,
            userNetBalanceCents,
            CurrencyUtil.formatCents(userNetBalanceCents, currency),
            totalSpendCents,
            CurrencyUtil.formatCents(totalSpendCents, currency),
            myRole
        );
    }

    public static String currencyOf(Group group) {
        return group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;
    }
}
