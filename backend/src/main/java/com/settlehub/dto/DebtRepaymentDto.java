package com.settlehub.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record DebtRepaymentDto(
    UUID fromUserId,
    String fromUserName,
    UUID toUserId,
    String toUserName,
    Long amountCents,
    String amountFormatted,
    String currencyCode
) {}
