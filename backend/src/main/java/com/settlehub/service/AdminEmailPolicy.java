package com.settlehub.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/** Admins are exactly the emails listed in APP_ADMIN_EMAILS (comma separated, empty by default). */
@Component
public class AdminEmailPolicy {

    private static final Logger log = LoggerFactory.getLogger(AdminEmailPolicy.class);

    private final Set<String> adminEmails;

    public AdminEmailPolicy(@Value("${app.admin.emails:}") String csv) {
        this.adminEmails = Arrays.stream(csv.split(","))
            .map(s -> s.trim().toLowerCase(Locale.ROOT))
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toUnmodifiableSet());
        if (adminEmails.isEmpty()) {
            log.warn("APP_ADMIN_EMAILS is not set: the admin portal is disabled for everyone.");
        } else {
            log.info("Admin portal enabled for {} account(s) from APP_ADMIN_EMAILS.", adminEmails.size());
        }
    }

    public boolean isAdmin(String email) {
        return email != null && adminEmails.contains(email.trim().toLowerCase(Locale.ROOT));
    }
}
