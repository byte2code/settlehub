package com.settlehub.service;

import com.settlehub.exception.TooManyRequestsException;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Small in-memory sliding-window limiter for chatty actions (reactions, comments). One free-tier instance, so no Redis. */
@Component
public class ActionRateLimiter {

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public void check(String key, int max, long windowMs) {
        long now = System.currentTimeMillis();
        if (hits.size() > 20_000) {
            hits.entrySet().removeIf(e -> e.getValue().isEmpty() || e.getValue().peekLast() < now - windowMs);
        }
        Deque<Long> window = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst() <= now - windowMs) window.pollFirst();
            if (window.size() >= max) throw new TooManyRequestsException("Slow down a little and try again in a minute.");
            window.addLast(now);
        }
    }
}
