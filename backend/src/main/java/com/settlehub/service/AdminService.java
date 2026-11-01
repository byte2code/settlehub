package com.settlehub.service;

import com.settlehub.dto.AdminDtos.*;
import com.settlehub.exception.BadRequestException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.User;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.SettlementRepository;
import com.settlehub.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.*;

@Service
public class AdminService {

    private static final int PAGE = 25;
    /** Table names are never user input; this fixed list is all that is ever inspected. */
    private static final List<String> TABLES = List.of("users", "expense_groups", "group_members", "expenses",
        "expense_splits", "expense_payers", "settlements", "user_notifications", "activities", "push_subscriptions", "email_verifications");

    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final EmailQuotaTracker quotaTracker;
    private final JdbcTemplate jdbc;

    public AdminService(UserRepository userRepository, GroupRepository groupRepository, ExpenseRepository expenseRepository,
                        SettlementRepository settlementRepository, EmailQuotaTracker quotaTracker, JdbcTemplate jdbc) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.quotaTracker = quotaTracker;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Overview overview() {
        Map<String, Long> expenses = toMap(expenseRepository.sumVolumeByCurrency());
        Map<String, Long> settled = toMap(settlementRepository.sumVolumeByCurrency());
        Map<String, Double> ratio = new TreeMap<>();
        expenses.forEach((cur, total) -> {
            if (total > 0) ratio.put(cur, Math.min(1.0, settled.getOrDefault(cur, 0L) / (double) total));
        });
        return new Overview(userRepository.countByPlaceholderFalse(), groupRepository.countByArchivedFalse(), groupRepository.count(),
            expenseRepository.countActive(), settlementRepository.count(), expenses, settled, ratio);
    }

    @Transactional(readOnly = true)
    public SystemHealth health() {
        long start = System.nanoTime();
        jdbc.queryForObject("SELECT 1", Integer.class);
        long latencyMs = (System.nanoTime() - start) / 1_000_000;
        String db = jdbc.execute((java.sql.Connection c) -> c.getMetaData().getDatabaseProductName());
        return new SystemHealth(quotaTracker.sentToday(), quotaTracker.dailyLimit(), latencyMs, db,
            "PostgreSQL".equalsIgnoreCase(db) ? postgresTables() : List.of(),
            ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
    }

    private List<TableStat> postgresTables() {
        try {
            return jdbc.query(
                "SELECT relname, pg_total_relation_size(relid) AS bytes, n_live_tup FROM pg_stat_user_tables WHERE relname = ANY (?) ORDER BY bytes DESC",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("text", TABLES.toArray())),
                (rs, i) -> new TableStat(rs.getString(1), rs.getLong(2), rs.getLong(3)));
        } catch (Exception e) {
            return List.of();
        }
    }

    @Transactional(readOnly = true)
    public List<AdminUser> users(String q) {
        return userRepository.searchForAdmin(pattern(q), PageRequest.of(0, PAGE)).stream()
            .map(r -> new AdminUser((UUID) r[0], (String) r[1],
                (r[3] == null || ((String) r[3]).isBlank()) ? (String) r[2] : r[2] + " " + r[3],
                (Instant) r[4], (Boolean) r[5], (Boolean) r[6], ((Number) r[7]).longValue()))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminGroup> groups(String q) {
        return groupRepository.searchForAdmin(pattern(q), PageRequest.of(0, PAGE)).stream()
            .map(r -> new AdminGroup((UUID) r[0], (String) r[1], (String) r[2], (Boolean) r[3], (Instant) r[4], ((Number) r[5]).longValue()))
            .toList();
    }

    @Transactional
    public AdminUser setActive(UUID adminId, UUID userId, boolean active) {
        User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        if (user.getId().equals(adminId)) throw new BadRequestException("You can't deactivate your own account");
        if (user.isAdmin() && !active) throw new BadRequestException("Admin accounts can't be deactivated");
        user.setActive(active);
        userRepository.save(user);
        return users(user.getEmail()).stream().filter(u -> u.id().equals(userId)).findFirst()
            .orElseThrow(() -> new NotFoundException("User not found"));
    }

    /** Lowercased LIKE pattern (escape char '!') so search text is matched literally, never as wildcards. */
    private static String pattern(String q) {
        String clean = q == null ? "" : q.trim().toLowerCase(Locale.ROOT).replaceAll("([!%_])", "!$1");
        return "%" + clean + "%";
    }

    private static Map<String, Long> toMap(List<Object[]> rows) {
        Map<String, Long> out = new TreeMap<>();
        for (Object[] r : rows) out.put((String) r[0], ((Number) r[1]).longValue());
        return out;
    }
}
