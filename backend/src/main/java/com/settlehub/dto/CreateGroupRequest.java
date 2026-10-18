package com.settlehub.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CreateGroupRequest(
    @NotBlank(message = "Group name is required")
    String name,
    String groupType,
    Boolean simplifyByDefault,
    String currencyCode,
    List<String> memberEmails
) {
    public CreateGroupRequest(String name, String groupType, Boolean simplifyByDefault, List<String> memberEmails) {
        this(name, groupType, simplifyByDefault, "INR", memberEmails);
    }
}
