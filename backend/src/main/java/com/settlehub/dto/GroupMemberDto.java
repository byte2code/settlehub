package com.settlehub.dto;

import com.settlehub.model.GroupMember;
import com.settlehub.util.CurrencyUtil;
import java.time.Instant;
import java.util.UUID;

public record GroupMemberDto(
    UUID id,
    UUID userId,
    String name,
    String email,
    String role,
    Instant joinedAt,
    Long netBalanceCents,
    String netBalanceFormatted
) {
    public static GroupMemberDto fromEntity(GroupMember member, Long netBalanceCents) {
        long bal = netBalanceCents != null ? netBalanceCents : 0L;
        String currency = (member.getGroup() != null && member.getGroup().getCurrencyCode() != null)
            ? member.getGroup().getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;
        String formatted = CurrencyUtil.formatCents(bal, currency);

        return new GroupMemberDto(
            member.getId(),
            member.getUser().getId(),
            member.getUser().getFullName(),
            member.getUser().getEmail(),
            member.getRole(),
            member.getJoinedAt(),
            bal,
            formatted
        );
    }
}
