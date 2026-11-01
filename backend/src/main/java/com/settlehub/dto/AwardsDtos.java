package com.settlehub.dto;

import java.time.Instant;
import java.util.List;

public final class AwardsDtos {
    private AwardsDtos() {}

    public record Award(String id, String emoji, String title, List<String> winners, String detail) {}

    /** revealed=false means nothing is shown yet; eligible says whether an admin can reveal now. */
    public record AwardsResponse(boolean revealed, boolean eligible, String message, Instant revealedAt, List<Award> awards) {}
}
