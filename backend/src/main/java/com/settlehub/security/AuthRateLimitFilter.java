package com.settlehub.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window limiter for login/register/password endpoints, keyed by client IP.
 * In-memory is enough for the single free-tier instance; no Redis required.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final long WINDOW_MS = 60_000;
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final int maxRequestsPerWindow;
    private final Clock clock;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    @Autowired
    public AuthRateLimitFilter(@Value("${app.rate-limit.auth-requests-per-minute:10}") int maxRequestsPerWindow) {
        this(maxRequestsPerWindow, Clock.systemUTC());
    }

    AuthRateLimitFilter(int maxRequestsPerWindow, Clock clock) {
        this.maxRequestsPerWindow = maxRequestsPerWindow;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) return true;
        String path = request.getRequestURI();
        return !(path.endsWith("/auth/login") || path.endsWith("/auth/register") || path.endsWith("/auth/me/password"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!tryAcquire(request.getRemoteAddr() + "|" + request.getRequestURI())) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":\"Too many attempts. Please wait a minute and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    boolean tryAcquire(String key) {
        long now = clock.millis();
        if (hits.size() > MAX_TRACKED_CLIENTS) {
            hits.entrySet().removeIf(e -> e.getValue().isEmpty() || e.getValue().peekLast() < now - WINDOW_MS);
        }
        Deque<Long> window = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst() <= now - WINDOW_MS) {
                window.pollFirst();
            }
            if (window.size() >= maxRequestsPerWindow) {
                return false;
            }
            window.addLast(now);
            return true;
        }
    }
}
