package com.settlehub.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cross-group view of who the current user owes and who owes them.
 * Currencies are never mixed: totals are keyed by currency and each person entry has a single currency.
 */
public record UserPaymentSummaryDto(
    Map<String, Long> totalOweByCurrency,
    Map<String, Long> totalReceivableByCurrency,
    List<PersonPaymentDto> peopleYouOwe,
    List<PersonPaymentDto> peopleWhoOweYou
) {
    /** {@code upiId} is only populated for {@code peopleYouOwe} (the user needs it to pay). */
    public record PersonPaymentDto(
        UUID userId,
        String userName,
        String upiId,
        String currencyCode,
        long totalAmountCents,
        List<GroupDebtDetailDto> groupBreakdown
    ) {}

    public record GroupDebtDetailDto(
        UUID groupId,
        String groupName,
        long amountCents
    ) {}
}
