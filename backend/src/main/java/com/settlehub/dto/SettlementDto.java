package com.settlehub.dto;

import com.settlehub.model.Settlement;
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
    Instant createdAt
) {
    public static SettlementDto fromEntity(Settlement s) {
        String formatted = String.format("$%.2f", s.getAmountCents() / 100.0);
        return new SettlementDto(
            s.getId(),
            s.getGroup() != null ? s.getGroup().getId() : null,
            s.getPayer().getId(),
            s.getPayer().getFullName(),
            s.getPayee().getId(),
            s.getPayee().getFullName(),
            s.getAmountCents(),
            formatted,
            s.getCurrencyCode(),
            s.getDate(),
            s.getCreatedAt()
        );
    }
}
