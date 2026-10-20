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
    String userNetBalanceFormatted
) {
    public static GroupDto fromEntity(Group group, List<GroupMemberDto> members, Long userNetBalanceCents) {
        long bal = userNetBalanceCents != null ? userNetBalanceCents : 0L;
        String currency = group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;
        String formatted = CurrencyUtil.formatCents(bal, currency);
        String formattedBudget = group.getBudgetCents() != null ? CurrencyUtil.formatCents(group.getBudgetCents(), currency) : null;

        return new GroupDto(
            group.getId(),
            group.getName(),
            group.getGroupType(),
            group.isSimplifyByDefault(),
            currency,
            group.getInviteCode(),
            group.isArchived(),
            group.getBudgetCents(),
            formattedBudget,
            group.getCreatedAt(),
            group.getUpdatedAt(),
            members,
            bal,
            formatted
        );
    }
}
