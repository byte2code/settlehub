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
    String netBalanceFormatted,
    boolean placeholder,
    String upiId
) {
    public static GroupMemberDto fromEntity(GroupMember member, String currency, Long netBalanceCents) {
        long bal = netBalanceCents != null ? netBalanceCents : 0L;
        return new GroupMemberDto(
            member.getId(),
            member.getUser().getId(),
            member.getUser().getFullName(),
            member.getUser().getEmail(),
            member.getRole(),
            member.getJoinedAt(),
            bal,
            CurrencyUtil.formatCents(bal, currency),
            member.getUser().isPlaceholder(),
            member.getUser().getUpiId()
        );
    }
}
