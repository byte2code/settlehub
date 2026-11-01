package com.settlehub.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneOffset;

/** Counts verification emails sent today (UTC) against the Brevo free-plan daily limit. In-memory: resets on restart. */
@Component
public class EmailQuotaTracker {

    private final int dailyLimit;
    private LocalDate day = LocalDate.now(ZoneOffset.UTC);
    private int sent;

    public EmailQuotaTracker(@Value("${app.mail.daily-limit:300}") int dailyLimit) {
        this.dailyLimit = dailyLimit;
    }

    public synchronized void recordSent() {
        rollover();
        sent++;
    }

    public synchronized int sentToday() {
        rollover();
        return sent;
    }

    public int dailyLimit() { return dailyLimit; }

    private void rollover() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (!today.equals(day)) {
            day = today;
            sent = 0;
        }
    }
}
