package com.settlehub.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Admins are exactly the emails listed in APP_ADMIN_EMAILS (comma separated, empty by default). */
@Component
public class AdminEmailPolicy {

    private final Set<String> adminEmails;

    public AdminEmailPolicy(@Value("${app.admin.emails:}") String csv) {
        this.adminEmails = Arrays.stream(csv.split(","))
            .map(s -> s.trim().toLowerCase(Locale.ROOT))
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(String email) {
        return email != null && adminEmails.contains(email.trim().toLowerCase(Locale.ROOT));
    }
}
