package com.settlehub.service;

import com.settlehub.dto.EngagementDtos.CommentDto;
import com.settlehub.dto.EngagementDtos.Engagement;
import com.settlehub.exception.BadRequestException;
import com.settlehub.exception.ForbiddenException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.Expense;
import com.settlehub.model.ExpenseComment;
import com.settlehub.model.ExpenseReaction;
import com.settlehub.model.User;
import com.settlehub.repository.ExpenseCommentRepository;
import com.settlehub.repository.ExpenseReactionRepository;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/** Emoji reactions and short plain-text comments on expenses. Members only; read-only once a group is archived. */
@Service
public class EngagementService {

    public static final Set<String> ALLOWED_EMOJI = new LinkedHashSet<>(List.of("🍕", "🔥", "😭", "😂", "👍", "❤️", "🤯", "💸"));
    static final int MAX_COMMENT_CODE_POINTS = 200;
    static final int MAX_COMMENTS_PER_EXPENSE = 100;
    private static final int MAX_ACTIONS_PER_MINUTE = 30;

    private final GroupAccessService access;
    private final ExpenseRepository expenseRepository;
    private final ExpenseReactionRepository reactionRepository;
    private final ExpenseCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final ActionRateLimiter limiter;
    private final WebSocketEventPublisher events;

    public EngagementService(GroupAccessService access, ExpenseRepository expenseRepository,
                             ExpenseReactionRepository reactionRepository, ExpenseCommentRepository commentRepository,
                             UserRepository userRepository, ActionRateLimiter limiter, WebSocketEventPublisher events) {
        this.access = access;
        this.expenseRepository = expenseRepository;
        this.reactionRepository = reactionRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.limiter = limiter;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public Map<UUID, Engagement> forGroup(UUID groupId, UUID userId) {
        access.requireMember(groupId, userId);
        List<UUID> ids = expenseRepository.findActiveIdsByGroupId(groupId);
        Map<UUID, Engagement> out = new LinkedHashMap<>();
        if (ids.isEmpty()) return out;
        Map<UUID, List<ExpenseReaction>> reactions = reactionRepository.findByExpenseIdIn(ids).stream()
            .collect(Collectors.groupingBy(ExpenseReaction::getExpenseId));
        Map<UUID, Integer> comments = new HashMap<>();
        for (Object[] row : commentRepository.countByExpenseIds(ids)) comments.put((UUID) row[0], ((Number) row[1]).intValue());
        for (UUID id : ids) {
            List<ExpenseReaction> list = reactions.getOrDefault(id, List.of());
            if (list.isEmpty() && !comments.containsKey(id)) continue;
            out.put(id, summarize(list, userId, comments.getOrDefault(id, 0)));
        }
        return out;
    }

    @Transactional
    public Engagement toggleReaction(UUID expenseId, UUID userId, String emoji) {
        Expense expense = writable(expenseId, userId);
        if (emoji == null || !ALLOWED_EMOJI.contains(emoji)) throw new BadRequestException("That reaction isn't available");
        limiter.check("engage:" + userId, MAX_ACTIONS_PER_MINUTE, 60_000);
        Optional<ExpenseReaction> existing = reactionRepository.findByExpenseIdAndUserIdAndEmoji(expenseId, userId, emoji);
        if (existing.isPresent()) reactionRepository.delete(existing.get());
        else reactionRepository.save(new ExpenseReaction(expenseId, userId, emoji));
        events.publishGroupEvent(expense.getGroup().getId(), "EXPENSE_ENGAGEMENT", userId, expenseId);
        return summarize(reactionRepository.findByExpenseId(expenseId), userId, (int) commentRepository.countByExpenseId(expenseId));
    }

    @Transactional(readOnly = true)
    public List<CommentDto> comments(UUID expenseId, UUID userId) {
        access.requireExpense(expenseId, userId);
        List<ExpenseComment> list = commentRepository.findByExpenseIdOrderByCreatedAtAsc(expenseId, PageRequest.of(0, MAX_COMMENTS_PER_EXPENSE));
        Map<UUID, String> names = userRepository.findAllById(list.stream().map(ExpenseComment::getUserId).collect(Collectors.toSet()))
            .stream().collect(Collectors.toMap(User::getId, User::getFullName));
        return list.stream().map(c -> toDto(c, names, userId)).toList();
    }

    @Transactional
    public CommentDto addComment(UUID expenseId, UUID userId, String rawBody) {
        Expense expense = writable(expenseId, userId);
        String body = normalize(rawBody);
        if (body.isEmpty()) throw new BadRequestException("Write something first");
        if (body.codePointCount(0, body.length()) > MAX_COMMENT_CODE_POINTS) {
            throw new BadRequestException("Comments can be at most " + MAX_COMMENT_CODE_POINTS + " characters");
        }
        if (commentRepository.countByExpenseId(expenseId) >= MAX_COMMENTS_PER_EXPENSE) {
            throw new BadRequestException("This expense has reached its comment limit");
        }
        limiter.check("engage:" + userId, MAX_ACTIONS_PER_MINUTE, 60_000);
        ExpenseComment saved = commentRepository.save(new ExpenseComment(expenseId, userId, body));
        events.publishGroupEvent(expense.getGroup().getId(), "EXPENSE_ENGAGEMENT", userId, expenseId);
        return toDto(saved, Map.of(userId, userRepository.findById(userId).map(User::getFullName).orElse("You")), userId);
    }

    @Transactional
    public void deleteComment(UUID commentId, UUID userId) {
        ExpenseComment comment = commentRepository.findById(commentId).orElseThrow(() -> new NotFoundException("Comment not found"));
        Expense expense = access.requireExpense(comment.getExpenseId(), userId);
        boolean author = comment.getUserId().equals(userId);
        if (!author) {
            // group admins may remove anyone's comment
            access.requireAdmin(expense.getGroup().getId(), userId);
        }
        commentRepository.delete(comment);
        events.publishGroupEvent(expense.getGroup().getId(), "EXPENSE_ENGAGEMENT", userId, expense.getId());
    }

    private Expense writable(UUID expenseId, UUID userId) {
        Expense expense = access.requireExpense(expenseId, userId);
        if (expense.getGroup().isArchived()) throw new ForbiddenException("This group is archived, so it's read-only");
        return expense;
    }

    /** Trims, drops control characters and collapses runs of whitespace. Comments are plain text everywhere. */
    static String normalize(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").trim();
    }

    private static Engagement summarize(List<ExpenseReaction> list, UUID userId, int comments) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String e : ALLOWED_EMOJI) {
            int n = (int) list.stream().filter(r -> r.getEmoji().equals(e)).count();
            if (n > 0) counts.put(e, n);
        }
        List<String> mine = list.stream().filter(r -> r.getUserId().equals(userId)).map(ExpenseReaction::getEmoji).toList();
        return new Engagement(counts, mine, comments);
    }

    private static CommentDto toDto(ExpenseComment c, Map<UUID, String> names, UUID viewer) {
        return new CommentDto(c.getId(), c.getUserId(), names.getOrDefault(c.getUserId(), "Former member"), c.getBody(), c.getCreatedAt(), c.getUserId().equals(viewer));
    }
}
