package com.settlehub.dto;

import com.settlehub.model.Settlement;
import com.settlehub.util.CurrencyUtil;
import java.time.Instant;
import java.util.UUID;

public record SettlementDto(
    UUID id,
    UUID groupId,
    UUID payerId,
    String payerName,
    UUID payeeId,
    String payeeName,
    Long amountCents,
    String amountFormatted,
    String currencyCode,
    Instant date,
    Instant createdAt,
    String note,
    String createdByName
) {
    public static SettlementDto fromEntity(Settlement s) {
        return new SettlementDto(
            s.getId(),
            s.getGroup() != null ? s.getGroup().getId() : null,
            s.getPayer().getId(),
            s.getPayer().getFullName(),
            s.getPayee().getId(),
            s.getPayee().getFullName(),
            s.getAmountCents(),
            CurrencyUtil.formatCents(s.getAmountCents(), s.getCurrencyCode()),
            s.getCurrencyCode(),
            s.getDate(),
            s.getCreatedAt(),
            s.getNote(),
            s.getCreatedBy() != null ? s.getCreatedBy().getFullName() : null
        );
    }
}
