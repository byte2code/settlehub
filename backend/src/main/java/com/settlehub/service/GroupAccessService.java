package com.settlehub.service;

import com.settlehub.exception.ForbiddenException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.Expense;
import com.settlehub.model.Group;
import com.settlehub.model.GroupMember;
import com.settlehub.model.Settlement;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.SettlementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Single place that decides whether a user may touch a group's data.
 * Non-members get 404 rather than 403 so group/expense ids cannot be probed.
 */
@Service
@Transactional(readOnly = true)
public class GroupAccessService {

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_MEMBER = "MEMBER";

    private final GroupMemberRepository groupMemberRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;

    public GroupAccessService(GroupMemberRepository groupMemberRepository,
                              ExpenseRepository expenseRepository,
                              SettlementRepository settlementRepository) {
        this.groupMemberRepository = groupMemberRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
    }

    public boolean isMember(UUID groupId, UUID userId) {
        return groupId != null && userId != null && groupMemberRepository.existsByGroupIdAndUserId(groupId, userId);
    }

    public GroupMember requireMember(UUID groupId, UUID userId) {
        return groupMemberRepository.findByGroupIdAndUserId(groupId, userId)
            .orElseThrow(() -> new NotFoundException("Group not found"));
    }

    public Group requireGroup(UUID groupId, UUID userId) {
        return requireMember(groupId, userId).getGroup();
    }

    public GroupMember requireAdmin(UUID groupId, UUID userId) {
        GroupMember member = requireMember(groupId, userId);
        if (!ROLE_ADMIN.equals(member.getRole())) {
            throw new ForbiddenException("Only group admins can do that");
        }
        return member;
    }

    public Expense requireExpense(UUID expenseId, UUID userId) {
        Expense expense = expenseRepository.findById(expenseId)
            .filter(e -> !e.isDeleted() && e.getGroup() != null)
            .orElseThrow(() -> new NotFoundException("Expense not found"));
        if (!isMember(expense.getGroup().getId(), userId)) {
            throw new NotFoundException("Expense not found");
        }
        return expense;
    }

    public Settlement requireSettlement(UUID settlementId, UUID userId) {
        Settlement settlement = settlementRepository.findById(settlementId)
            .filter(s -> s.getGroup() != null)
            .orElseThrow(() -> new NotFoundException("Settlement not found"));
        if (!isMember(settlement.getGroup().getId(), userId)) {
            throw new NotFoundException("Settlement not found");
        }
        return settlement;
    }
}
