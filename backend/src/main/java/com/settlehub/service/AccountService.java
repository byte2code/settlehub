package com.settlehub.service;

import com.settlehub.dto.UserDto;
import com.settlehub.exception.BadRequestException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.*;
import com.settlehub.repository.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static com.settlehub.service.GroupAccessService.ROLE_ADMIN;

/** Data export and account deletion. Deleting keeps other people's ledgers correct by anonymizing, not removing, the person. */
@Service
public class AccountService {

    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final PushSubscriptionRepository pushRepository;
    private final UserNotificationRepository notificationRepository;
    private final EmailVerificationRepository verificationRepository;
    private final BalanceService balanceService;
    private final AdminEmailPolicy adminPolicy;
    private final PasswordEncoder passwordEncoder;
    private final ActionRateLimiter limiter;

    public AccountService(UserRepository userRepository, GroupRepository groupRepository, GroupMemberRepository memberRepository,
                          ExpenseRepository expenseRepository, SettlementRepository settlementRepository,
                          PushSubscriptionRepository pushRepository, UserNotificationRepository notificationRepository,
                          EmailVerificationRepository verificationRepository, BalanceService balanceService,
                          AdminEmailPolicy adminPolicy, PasswordEncoder passwordEncoder, ActionRateLimiter limiter) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.pushRepository = pushRepository;
        this.notificationRepository = notificationRepository;
        this.verificationRepository = verificationRepository;
        this.balanceService = balanceService;
        this.adminPolicy = adminPolicy;
        this.passwordEncoder = passwordEncoder;
        this.limiter = limiter;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> export(UUID userId) {
        limiter.check("export:" + userId, 5, 3_600_000);
        User user = require(userId);
        List<Map<String, Object>> groups = new ArrayList<>();
        List<Map<String, Object>> expenses = new ArrayList<>();
        List<Map<String, Object>> settlements = new ArrayList<>();
        for (Group g : groupRepository.findAllForUser(userId)) {
            String role = memberRepository.findByGroupIdAndUserId(g.getId(), userId).map(GroupMember::getRole).orElse("MEMBER");
            groups.add(orderedMap("id", g.getId(), "name", g.getName(), "currency", g.getCurrencyCode(), "archived", g.isArchived(), "myRole", role));
            for (Expense e : expenseRepository.findActiveByGroupId(g.getId())) {
                long paid = e.getPayers().stream().filter(p -> p.getUser().getId().equals(userId)).mapToLong(ExpensePayer::getPaidCents).sum();
                long owed = e.getSplits().stream().filter(s -> s.getUser().getId().equals(userId)).mapToLong(ExpenseSplit::getOwedCents).sum();
                if (paid == 0 && owed == 0) continue;
                expenses.add(orderedMap("group", g.getName(), "description", e.getDescription(), "date", e.getDate(), "category", e.getCategory(),
                    "currency", e.getCurrencyCode(), "totalCents", e.getCostCents(), "youPaidCents", paid, "yourShareCents", owed));
            }
            for (Settlement s : settlementRepository.findByGroupId(g.getId())) {
                if (!s.getPayer().getId().equals(userId) && !s.getPayee().getId().equals(userId)) continue;
                settlements.add(orderedMap("group", g.getName(), "date", s.getDate(), "amountCents", s.getAmountCents(), "currency", s.getCurrencyCode(),
                    "direction", s.getPayer().getId().equals(userId) ? "you paid" : "you received", "note", s.getNote()));
            }
        }
        return orderedMap("exportedAt", Instant.now(), "profile", UserDto.fromEntity(user), "groups", groups, "expenses", expenses, "settlements", settlements);
    }

    /**
     * Anonymizes the account. Refused while money is unsettled (so nobody is left owed by a ghost) and for admin accounts.
     * Group ledgers keep their amounts; the person shows as "Deleted user".
     */
    @Transactional
    public void delete(UUID userId, String password, String confirmEmail) {
        User user = require(userId);
        if (confirmEmail == null || !confirmEmail.trim().equalsIgnoreCase(user.getEmail())) {
            throw new BadRequestException("Type your email address to confirm");
        }
        if (user.isPasswordLogin() && (password == null || !passwordEncoder.matches(password, user.getPassword()))) {
            throw new BadRequestException("Password is incorrect");
        }
        if (user.isAdmin() || adminPolicy.isAdmin(user.getEmail())) {
            throw new BadRequestException("Admin accounts can't be deleted here");
        }

        List<Group> groups = groupRepository.findAllForUser(userId);
        List<String> unsettled = new ArrayList<>();
        for (Group g : groups) {
            if (g.isArchived()) continue;
            long net = balanceService.netBalances(g.getId()).getOrDefault(userId, 0L);
            if (net != 0) unsettled.add(g.getName());
        }
        if (!unsettled.isEmpty()) {
            throw new BadRequestException("Settle up first in: " + String.join(", ", unsettled));
        }

        for (Group g : groups) {
            List<GroupMember> members = memberRepository.findAllByGroupId(g.getId());
            boolean iAmAdmin = members.stream().anyMatch(m -> m.getUser().getId().equals(userId) && ROLE_ADMIN.equals(m.getRole()));
            boolean otherAdmin = members.stream().anyMatch(m -> !m.getUser().getId().equals(userId) && ROLE_ADMIN.equals(m.getRole()));
            if (iAmAdmin && !otherAdmin) {
                members.stream().filter(m -> !m.getUser().getId().equals(userId)).findFirst().ifPresent(m -> {
                    m.setRole(ROLE_ADMIN);
                    memberRepository.save(m);
                });
            }
        }

        String oldEmail = user.getEmail();
        byte[] noise = new byte[24];
        new SecureRandom().nextBytes(noise);
        user.setEmail("deleted-" + user.getId() + "@deleted.invalid");
        user.setFirstName("Deleted");
        user.setLastName("user");
        user.setPassword(passwordEncoder.encode(Base64.getEncoder().encodeToString(noise)));
        user.setPasswordLogin(false);
        user.setUpiId(null);
        user.setBio(null);
        user.setAvatarId(null);
        user.setChimeSound(null);
        user.setAdmin(false);
        user.setActive(false);
        user.bumpTokenVersion();
        userRepository.save(user);

        pushRepository.deleteAll(pushRepository.findByUserId(userId));
        notificationRepository.deleteAll(notificationRepository.findAllByUserId(userId));
        verificationRepository.deleteByEmail(oldEmail.toLowerCase(Locale.ROOT));
    }

    private User require(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
    }

    private static Map<String, Object> orderedMap(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}
