package com.settlehub.service;

import com.settlehub.dto.CreateSettlementRequest;
import com.settlehub.dto.SettlementDto;
import com.settlehub.model.*;
import com.settlehub.repository.*;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class SettlementService {

    private final SettlementRepository settlementRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final WebSocketEventPublisher eventPublisher;

    public SettlementService(SettlementRepository settlementRepository,
                             GroupRepository groupRepository,
                             UserRepository userRepository,
                             ExpenseRepository expenseRepository,
                             WebSocketEventPublisher eventPublisher) {
        this.settlementRepository = settlementRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.expenseRepository = expenseRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public SettlementDto recordSettlement(UUID currentUserId, CreateSettlementRequest request) {
        User payer = userRepository.findById(currentUserId)
            .orElseThrow(() -> new IllegalArgumentException("Payer user not found: " + currentUserId));

        User payee = userRepository.findById(request.payeeId())
            .orElseThrow(() -> new IllegalArgumentException("Payee user not found: " + request.payeeId()));

        if (payer.getId().equals(payee.getId())) {
            throw new IllegalArgumentException("Cannot settle up with yourself.");
        }

        Group group = null;
        if (request.groupId() != null) {
            group = groupRepository.findById(request.groupId())
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + request.groupId()));
        }

        Instant date = request.date() != null ? request.date() : Instant.now();
        String currency = (request.currencyCode() != null && !request.currencyCode().isBlank())
            ? request.currencyCode().trim().toUpperCase()
            : (group != null && group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY);

        Settlement settlement = new Settlement(
            group,
            payer,
            payee,
            request.amountCents(),
            currency,
            date
        );
        settlement = settlementRepository.save(settlement);

        // Also record as a payment expense if within a group, mirroring Splitwise payment: true design
        if (group != null) {
            Expense paymentExpense = new Expense(
                group,
                String.format("Payment: %s paid %s", payer.getFirstName(), payee.getFirstName()),
                request.amountCents(),
                currency,
                date,
                "PAYMENT",
                true,
                payer
            );
            paymentExpense.addPayer(payer, request.amountCents());
            paymentExpense.addSplit(payee, request.amountCents());
            expenseRepository.save(paymentExpense);

            group.setUpdatedAt(Instant.now());
            groupRepository.save(group);
            eventPublisher.publishGroupEvent(group.getId(), "SETTLEMENT_RECORDED", SettlementDto.fromEntity(settlement));
        }

        return SettlementDto.fromEntity(settlement);
    }

    @Transactional(readOnly = true)
    public java.util.List<SettlementDto> getSettlementsForGroup(UUID groupId) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        return settlementRepository.findAllByGroupOrderByDateDesc(group).stream()
            .map(SettlementDto::fromEntity)
            .toList();
    }
}
