package com.settlehub.dto;

import java.util.UUID;

/** What a person sees before joining via invite link; no balances or member details. */
public record InvitePreviewDto(
    String inviteCode,
    String groupName,
    String groupType,
    String currencyCode,
    long memberCount,
    boolean alreadyMember,
    UUID groupId
) {}
