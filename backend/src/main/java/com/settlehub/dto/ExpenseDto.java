package com.settlehub.dto;

import com.settlehub.model.Expense;
import com.settlehub.util.CurrencyUtil;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExpenseDto(
    UUID id,
    UUID groupId,
    String description,
    Long costCents,
    String costFormatted,
    String currencyCode,
    Instant date,
    String creationMethod,
    boolean isPayment,
    String category,
    boolean hasReceipt,
    String notes,
    String originalCurrency,
    Long originalAmountCents,
    String originalFormatted,
    UserDto createdBy,
    List<PayerDto> payers,
    List<SplitDto> splits,
    Instant createdAt,
    Instant updatedAt
) {
    public record PayerDto(UUID userId, String userName, Long paidCents, String paidFormatted) {}
    public record SplitDto(UUID userId, String userName, Long owedCents, String owedFormatted) {}

    public static ExpenseDto fromEntity(Expense expense) {
        String currency = expense.getCurrencyCode() != null ? expense.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;

        List<PayerDto> payerDtos = expense.getPayers().stream()
            .map(p -> new PayerDto(
                p.getUser().getId(),
                p.getUser().getFullName(),
                p.getPaidCents(),
                CurrencyUtil.formatCents(p.getPaidCents(), currency)
            ))
            .toList();

        List<SplitDto> splitDtos = expense.getSplits().stream()
            .map(s -> new SplitDto(
                s.getUser().getId(),
                s.getUser().getFullName(),
                s.getOwedCents(),
                CurrencyUtil.formatCents(s.getOwedCents(), currency)
            ))
            .toList();

        String originalFormatted = expense.getOriginalCurrency() != null && expense.getOriginalAmountCents() != null
            ? CurrencyUtil.formatCents(expense.getOriginalAmountCents(), expense.getOriginalCurrency())
            : null;

        return new ExpenseDto(
            expense.getId(),
            expense.getGroup() != null ? expense.getGroup().getId() : null,
            expense.getDescription(),
            expense.getCostCents(),
            CurrencyUtil.formatCents(expense.getCostCents(), currency),
            currency,
            expense.getDate(),
            expense.getCreationMethod(),
            expense.isPayment(),
            expense.getCategory(),
            expense.hasReceipt(),
            expense.getNotes(),
            expense.getOriginalCurrency(),
            expense.getOriginalAmountCents(),
            originalFormatted,
            UserDto.fromEntity(expense.getCreatedBy()),
            payerDtos,
            splitDtos,
            expense.getCreatedAt(),
            expense.getUpdatedAt()
        );
    }
}
