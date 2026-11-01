package com.settlehub.dto;

import com.settlehub.model.RecurringExpense;
import com.settlehub.util.CurrencyUtil;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class RecurringDtos {
    private RecurringDtos() {}

    public record CreateRequest(
        @NotBlank @Size(max = 140) String description,
        @NotNull @Positive @Max(100_000_000_000L) Long costCents,
        @Pattern(regexp = "^$|^(FOOD|TRANSPORT|STAY|ENTERTAINMENT|SHOPPING|UTILITIES|OTHER)$") String category,
        @NotNull UUID payerId,
        @NotEmpty @Size(max = 50) List<UUID> participantIds,
        @NotNull @Pattern(regexp = "WEEKLY|MONTHLY") String frequency,
        /** Date of the occurrence that already exists (or today); the next one is scheduled after it. */
        LocalDate startDate
    ) {}

    public record RecurringDto(UUID id, String description, long costCents, String costFormatted, String category, UUID payerId,
                               List<UUID> participantIds, String frequency, LocalDate nextRunDate, boolean active, String pausedReason) {
        public static RecurringDto fromEntity(RecurringExpense r, String currency) {
            return new RecurringDto(r.getId(), r.getDescription(), r.getCostCents(), CurrencyUtil.formatCents(r.getCostCents(), currency),
                r.getCategory(), r.getPayerId(), java.util.Arrays.stream(r.getParticipants().split(",")).map(UUID::fromString).toList(),
                r.getFrequency(), r.getNextRunDate(), r.isActive(), r.getPausedReason());
        }
    }
}
