package com.settlehub.dto;

import java.util.List;

public record NotificationSummaryDto(
    List<NotificationDto> notifications,
    long unreadCount
) {}

