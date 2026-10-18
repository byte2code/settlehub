package com.settlehub.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record GroupBalanceSummaryDto(
    UUID groupId,
    String groupName,
    boolean simplifyByDefault,
    List<DebtRepaymentDto> simplifiedDebts,
    List<DebtRepaymentDto> originalDebts,
    int savedTransactionsCount,
    Map<UUID, Long> netBalances,
    Map<UUID, String> netBalancesFormatted
) {}
