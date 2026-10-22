package com.settlehub.dto;

import com.settlehub.model.Activity;
import com.settlehub.util.CurrencyUtil;
import java.time.Instant;
import java.util.UUID;

public record ActivityDto(
    UUID id,
    String type,
    String summary,
    UUID actorId,
    String actorName,
    Long amountCents,
    String amountFormatted,
    Instant createdAt
) {
    public static ActivityDto fromEntity(Activity a, String currency) {
        return new ActivityDto(
            a.getId(),
            a.getType().name(),
            a.getSummary(),
            a.getActor() != null ? a.getActor().getId() : null,
            a.getActor() != null ? a.getActor().getFullName() : "Someone",
            a.getAmountCents(),
            a.getAmountCents() != null ? CurrencyUtil.formatCents(a.getAmountCents(), currency) : null,
            a.getCreatedAt()
        );
    }
}
