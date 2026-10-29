package com.settlehub.service;

import com.settlehub.dto.CreateSettlementRequest;
import com.settlehub.dto.SettlementDto;
import com.settlehub.exception.ForbiddenException;
import com.settlehub.model.*;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.SettlementRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static com.settlehub.service.GroupAccessService.ROLE_ADMIN;

@Service
public class SettlementService {

    private final SettlementRepository settlementRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupAccessService access;
    private final ActivityService activityService;
    private final WebSocketEventPublisher events;
    private final NotificationService notificationService;

    public SettlementService(SettlementRepository settlementRepository,
                             GroupRepository groupRepository,
                             GroupMemberRepository groupMemberRepository,
                             GroupAccessService access,
                             ActivityService activityService,
                             WebSocketEventPublisher events,
                             NotificationService notificationService) {
        this.settlementRepository = settlementRepository;
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.access = access;
        this.activityService = activityService;
        this.events = events;
        this.notificationService = notificationService;
    }

    /**
     * Records "payer paid payee". Any member may record a payment between two members
     * (every change is in the activity feed). The amount is always in the group currency.
     */
    @Transactional
    public SettlementDto recordSettlement(UUID currentUserId, CreateSettlementRequest request) {
        GroupMember me = access.requireMember(request.groupId(), currentUserId);
        Group group = me.getGroup();
        UUID payerId = request.payerId() != null ? request.payerId() : currentUserId;

        User payer = memberUser(group.getId(), payerId);
        User payee = memberUser(group.getId(), request.payeeId());
        if (payer.getId().equals(payee.getId())) {
            throw new IllegalArgumentException("Payer and payee must be different people");
        }

        Settlement settlement = new Settlement(group, payer, payee, request.amountCents(), group.getCurrencyCode(),
            request.date() != null ? request.date() : Instant.now());
        settlement.setCreatedBy(me.getUser());
        if (request.note() != null && !request.note().isBlank()) {
            settlement.setNote(request.note().trim());
        }
        settlement = settlementRepository.save(settlement);

        group.setUpdatedAt(Instant.now());
        groupRepository.save(group);
        String who = payer.getId().equals(currentUserId) ? payer.getFirstName() : me.getUser().getFirstName()
            + " recorded that " + payer.getFirstName();
        activityService.record(group, me.getUser(), Activity.Type.SETTLEMENT_RECORDED,
            who + " paid " + payee.getFirstName() + " " + CurrencyUtil.formatCents(request.amountCents(), group.getCurrencyCode()),
            request.amountCents());
        events.publishGroupEvent(group.getId(), "SETTLEMENT_RECORDED", currentUserId, settlement.getId());
        notificationService.notifySettlementRecorded(settlement, me.getUser());
        return SettlementDto.fromEntity(settlement);
    }

    @Transactional(readOnly = true)
    public List<SettlementDto> getSettlementsForGroup(UUID groupId, UUID currentUserId) {
        access.requireMember(groupId, currentUserId);
        return settlementRepository.findByGroupId(groupId).stream()
            .map(SettlementDto::fromEntity)
            .toList();
    }

    /** Undo a recorded payment. Allowed for the payer, the payee, whoever recorded it, and admins. */
    @Transactional
    public void deleteSettlement(UUID settlementId, UUID currentUserId) {
        Settlement settlement = access.requireSettlement(settlementId, currentUserId);
        Group group = settlement.getGroup();
        GroupMember me = access.requireMember(group.getId(), currentUserId);
        boolean involved = settlement.getPayer().getId().equals(currentUserId)
            || settlement.getPayee().getId().equals(currentUserId)
            || (settlement.getCreatedBy() != null && settlement.getCreatedBy().getId().equals(currentUserId));
        if (!involved && !ROLE_ADMIN.equals(me.getRole())) {
            throw new ForbiddenException("Only the people involved or a group admin can undo this payment");
        }

        settlementRepository.delete(settlement);
        group.setUpdatedAt(Instant.now());
        groupRepository.save(group);
        activityService.record(group, me.getUser(), Activity.Type.SETTLEMENT_DELETED,
            me.getUser().getFirstName() + " removed the payment " + settlement.getPayer().getFirstName() + " → "
                + settlement.getPayee().getFirstName() + " ("
                + CurrencyUtil.formatCents(settlement.getAmountCents(), settlement.getCurrencyCode()) + ")",
            settlement.getAmountCents());
        events.publishGroupEvent(group.getId(), "SETTLEMENT_DELETED", currentUserId, settlementId);
        notificationService.notifySettlementDeleted(group, me.getUser(), settlement.getPayer().getFirstName(),
                settlement.getPayee().getFirstName(), settlement.getAmountCents());
    }

    private User memberUser(UUID groupId, UUID userId) {
        return groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
            .map(GroupMember::getUser)
            .orElseThrow(() -> new IllegalArgumentException("Payer and payee must both be members of the group"));
    }
}
