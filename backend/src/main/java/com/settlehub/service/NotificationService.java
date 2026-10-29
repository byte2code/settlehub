package com.settlehub.service;

import com.settlehub.dto.NotificationDto;
import com.settlehub.dto.NotificationSummaryDto;
import com.settlehub.model.*;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.UserNotificationRepository;
import com.settlehub.util.CurrencyUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final UserNotificationRepository notificationRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final WebSocketEventPublisher events;

    public NotificationService(UserNotificationRepository notificationRepository,
                               GroupMemberRepository groupMemberRepository,
                               WebSocketEventPublisher events) {
        this.notificationRepository = notificationRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public NotificationSummaryDto getUserNotifications(UUID userId, int limit) {
        int max = Math.min(Math.max(limit, 1), 50);
        List<NotificationDto> list = notificationRepository.findByUserId(userId, PageRequest.of(0, max))
                .stream()
                .map(NotificationDto::fromEntity)
                .toList();
        long unread = notificationRepository.countUnreadByUserId(userId);
        return new NotificationSummaryDto(list, unread);
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID userId) {
        notificationRepository.markAsRead(notificationId, userId);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllReadByUserId(userId);
        // Sync across tabs / devices
        events.publishUserNotification(userId, Map.of(
                "type", "NOTIFICATIONS_READ_ALL",
                "timestamp", java.time.Instant.now().toString()
        ));
    }

    @Transactional
    public void notifyExpenseCreated(Expense expense, User actor) {
        Group group = expense.getGroup();
        String currency = group.getCurrencyCode();
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(group.getId());

        Map<UUID, Long> splitsByUserId = new HashMap<>();
        for (ExpenseSplit split : expense.getSplits()) {
            splitsByUserId.put(split.getUser().getId(), split.getOwedCents());
        }

        Map<UUID, Long> payersByUserId = new HashMap<>();
        for (ExpensePayer payer : expense.getPayers()) {
            payersByUserId.put(payer.getUser().getId(), payer.getPaidCents());
        }

        for (GroupMember m : members) {
            UUID memberUserId = m.getUser().getId();
            // Suppress notification for the actor who created the expense
            if (memberUserId.equals(actor.getId())) {
                continue;
            }

            String title = "💸 " + group.getName() + ": " + expense.getDescription();
            String message;

            Long owed = splitsByUserId.get(memberUserId);
            Long paid = payersByUserId.get(memberUserId);

            if (owed != null && owed > 0) {
                message = actor.getFirstName() + " added \"" + expense.getDescription() + "\" ("
                        + CurrencyUtil.formatCents(expense.getCostCents(), currency) + "). Your share: "
                        + CurrencyUtil.formatCents(owed, currency) + ".";
            } else if (paid != null && paid > 0) {
                message = actor.getFirstName() + " recorded \"" + expense.getDescription() + "\" ("
                        + CurrencyUtil.formatCents(expense.getCostCents(), currency) + "). You paid "
                        + CurrencyUtil.formatCents(paid, currency) + ".";
            } else {
                message = actor.getFirstName() + " added \"" + expense.getDescription() + "\" ("
                        + CurrencyUtil.formatCents(expense.getCostCents(), currency) + ") in " + group.getName() + ".";
            }

            UserNotification notification = new UserNotification(
                    memberUserId,
                    actor,
                    group.getId(),
                    expense.getId(),
                    "EXPENSE_CREATED",
                    title,
                    message
            );
            UserNotification saved = notificationRepository.save(notification);
            events.publishUserNotification(memberUserId, NotificationDto.fromEntity(saved));
        }
    }

    @Transactional
    public void notifyExpenseUpdated(Expense expense, User actor) {
        Group group = expense.getGroup();
        String currency = group.getCurrencyCode();
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(group.getId());

        for (GroupMember m : members) {
            UUID memberUserId = m.getUser().getId();
            if (memberUserId.equals(actor.getId())) continue;

            String title = "✏️ " + group.getName() + ": " + expense.getDescription();
            String message = actor.getFirstName() + " updated \"" + expense.getDescription() + "\" ("
                    + CurrencyUtil.formatCents(expense.getCostCents(), currency) + ").";

            UserNotification notification = new UserNotification(
                    memberUserId,
                    actor,
                    group.getId(),
                    expense.getId(),
                    "EXPENSE_UPDATED",
                    title,
                    message
            );
            UserNotification saved = notificationRepository.save(notification);
            events.publishUserNotification(memberUserId, NotificationDto.fromEntity(saved));
        }
    }

    @Transactional
    public void notifyExpenseDeleted(Group group, User actor, String description, long costCents) {
        String currency = group.getCurrencyCode();
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(group.getId());

        for (GroupMember m : members) {
            UUID memberUserId = m.getUser().getId();
            if (memberUserId.equals(actor.getId())) continue;

            String title = "🗑️ " + group.getName() + ": Expense deleted";
            String message = actor.getFirstName() + " removed \"" + description + "\" ("
                    + CurrencyUtil.formatCents(costCents, currency) + ").";

            UserNotification notification = new UserNotification(
                    memberUserId,
                    actor,
                    group.getId(),
                    null,
                    "EXPENSE_DELETED",
                    title,
                    message
            );
            UserNotification saved = notificationRepository.save(notification);
            events.publishUserNotification(memberUserId, NotificationDto.fromEntity(saved));
        }
    }

    @Transactional
    public void notifySettlementRecorded(Settlement settlement, User actor) {
        Group group = settlement.getGroup();
        String currency = settlement.getCurrencyCode();
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(group.getId());

        User payer = settlement.getPayer();
        User payee = settlement.getPayee();
        long amount = settlement.getAmountCents();

        for (GroupMember m : members) {
            UUID memberUserId = m.getUser().getId();
            if (memberUserId.equals(actor.getId())) continue;

            String title;
            String message;

            if (memberUserId.equals(payee.getId())) {
                title = "💰 Payment Received in " + group.getName();
                message = payer.getFirstName() + " paid you " + CurrencyUtil.formatCents(amount, currency) + ".";
            } else if (memberUserId.equals(payer.getId())) {
                title = "🤝 Payment Recorded in " + group.getName();
                message = actor.getFirstName() + " recorded that you paid " + payee.getFirstName() + " "
                        + CurrencyUtil.formatCents(amount, currency) + ".";
            } else {
                title = "🤝 Settlement in " + group.getName();
                message = payer.getFirstName() + " paid " + payee.getFirstName() + " "
                        + CurrencyUtil.formatCents(amount, currency) + ".";
            }

            UserNotification notification = new UserNotification(
                    memberUserId,
                    actor,
                    group.getId(),
                    settlement.getId(),
                    "SETTLEMENT_RECORDED",
                    title,
                    message
            );
            UserNotification saved = notificationRepository.save(notification);
            events.publishUserNotification(memberUserId, NotificationDto.fromEntity(saved));
        }
    }

    @Transactional
    public void notifySettlementDeleted(Group group, User actor, String payerName, String payeeName, long amountCents) {
        String currency = group.getCurrencyCode();
        List<GroupMember> members = groupMemberRepository.findAllByGroupId(group.getId());

        for (GroupMember m : members) {
            UUID memberUserId = m.getUser().getId();
            if (memberUserId.equals(actor.getId())) continue;

            String title = "🗑️ " + group.getName() + ": Payment deleted";
            String message = actor.getFirstName() + " deleted payment of "
                    + CurrencyUtil.formatCents(amountCents, currency) + " from " + payerName + " to " + payeeName + ".";

            UserNotification notification = new UserNotification(
                    memberUserId,
                    actor,
                    group.getId(),
                    null,
                    "SETTLEMENT_DELETED",
                    title,
                    message
            );
            UserNotification saved = notificationRepository.save(notification);
            events.publishUserNotification(memberUserId, NotificationDto.fromEntity(saved));
        }
    }
}

