package com.settlehub.service;

import com.settlehub.dto.*;
import com.settlehub.exception.ConflictException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.Activity;
import com.settlehub.model.Group;
import com.settlehub.model.GroupMember;
import com.settlehub.model.User;
import com.settlehub.repository.*;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static com.settlehub.service.GroupAccessService.ROLE_ADMIN;
import static com.settlehub.service.GroupAccessService.ROLE_MEMBER;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final ExpenseRepository expenseRepository;
    private final SettlementRepository settlementRepository;
    private final ActivityRepository activityRepository;
    private final BalanceService balanceService;
    private final GroupAccessService access;
    private final ActivityService activityService;
    private final WebSocketEventPublisher events;

    public GroupService(GroupRepository groupRepository,
                        GroupMemberRepository groupMemberRepository,
                        UserRepository userRepository,
                        ExpenseRepository expenseRepository,
                        SettlementRepository settlementRepository,
                        ActivityRepository activityRepository,
                        BalanceService balanceService,
                        GroupAccessService access,
                        ActivityService activityService,
                        WebSocketEventPublisher events) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.userRepository = userRepository;
        this.expenseRepository = expenseRepository;
        this.settlementRepository = settlementRepository;
        this.activityRepository = activityRepository;
        this.balanceService = balanceService;
        this.access = access;
        this.activityService = activityService;
        this.events = events;
    }

    // ---------------------------------------------------------------- queries

    @Transactional(readOnly = true)
    public List<GroupDto> getUserGroups(UUID currentUserId) {
        return toDtos(groupRepository.findAllForUser(currentUserId), currentUserId);
    }

    @Transactional(readOnly = true)
    public GroupDto getGroupDetails(UUID groupId, UUID currentUserId) {
        return toDtos(List.of(access.requireGroup(groupId, currentUserId)), currentUserId).get(0);
    }

    private List<GroupDto> toDtos(List<Group> groups, UUID currentUserId) {
        List<UUID> ids = groups.stream().map(Group::getId).toList();
        List<GroupMember> allMembers = ids.isEmpty() ? List.of() : groupMemberRepository.findAllByGroupIdIn(ids);
        Map<UUID, List<GroupMember>> membersByGroup = allMembers.stream()
            .collect(Collectors.groupingBy(m -> m.getGroup().getId(), LinkedHashMap::new, Collectors.toList()));
        Map<UUID, Map<UUID, Long>> balances = balanceService.netBalancesForGroups(ids, allMembers);
        Map<UUID, Long> spend = balanceService.totalSpend(ids);

        List<GroupDto> result = new ArrayList<>();
        for (Group group : groups) {
            String currency = GroupDto.currencyOf(group);
            Map<UUID, Long> net = balances.getOrDefault(group.getId(), Map.of());
            List<GroupMember> members = membersByGroup.getOrDefault(group.getId(), List.of());
            List<GroupMemberDto> memberDtos = members.stream()
                .map(m -> GroupMemberDto.fromEntity(m, currency, net.get(m.getUser().getId())))
                .toList();
            String myRole = members.stream()
                .filter(m -> m.getUser().getId().equals(currentUserId))
                .map(GroupMember::getRole)
                .findFirst().orElse(ROLE_MEMBER);
            result.add(GroupDto.fromEntity(group, memberDtos, net.getOrDefault(currentUserId, 0L),
                spend.getOrDefault(group.getId(), 0L), myRole));
        }
        return result;
    }

    // ---------------------------------------------------------------- create / update / delete

    @Transactional
    public GroupDto createGroup(UUID currentUserId, CreateGroupRequest request) {
        User creator = requireUser(currentUserId);
        boolean simplify = request.simplifyByDefault() == null || request.simplifyByDefault();
        String currency = (request.currencyCode() != null && !request.currencyCode().isBlank())
            ? CurrencyUtil.normalize(request.currencyCode())
            : CurrencyUtil.normalize(creator.getCurrencyCode());

        Group group = new Group(request.name().trim(), blankToNull(request.groupType()), simplify, currency);
        group.setInviteCode(uniqueInviteCode());
        if (request.budgetCents() != null && request.budgetCents() > 0) {
            group.setBudgetCents(request.budgetCents());
        }
        group = groupRepository.save(group);
        groupMemberRepository.save(new GroupMember(group, creator, ROLE_ADMIN));
        activityService.record(group, creator, Activity.Type.GROUP_CREATED,
            creator.getFirstName() + " created the group", null);

        if (request.memberEmails() != null) {
            for (String email : request.memberEmails()) {
                if (email == null || email.isBlank()) continue;
                String cleanEmail = email.trim().toLowerCase(Locale.ROOT);
                if (cleanEmail.equals(creator.getEmail()) || !cleanEmail.contains("@")) continue;
                User member = findOrCreatePlaceholder(cleanEmail, currency);
                if (!groupMemberRepository.existsByGroupIdAndUserId(group.getId(), member.getId())) {
                    groupMemberRepository.save(new GroupMember(group, member, ROLE_MEMBER));
                }
            }
        }
        return getGroupDetails(group.getId(), currentUserId);
    }

    @Transactional
    public GroupDto updateGroupSettings(UUID groupId, UUID currentUserId, UpdateGroupRequest request) {
        GroupMember me = access.requireMember(groupId, currentUserId);
        Group group = me.getGroup();
        User actor = me.getUser();
        List<String> changes = new ArrayList<>();

        if (request.name() != null && !request.name().isBlank() && !request.name().trim().equals(group.getName())) {
            group.setName(request.name().trim());
            changes.add("renamed the group to \"" + group.getName() + "\"");
        }
        if (request.groupType() != null && !request.groupType().equals(group.getGroupType())) {
            group.setGroupType(request.groupType());
            changes.add("changed the group type to " + request.groupType());
        }
        if (request.simplifyByDefault() != null && request.simplifyByDefault() != group.isSimplifyByDefault()) {
            group.setSimplifyByDefault(request.simplifyByDefault());
            changes.add((request.simplifyByDefault() ? "turned on" : "turned off") + " debt simplification");
        }
        if (request.budgetCents() != null) {
            Long budget = request.budgetCents() > 0 ? request.budgetCents() : null;
            if (!Objects.equals(budget, group.getBudgetCents())) {
                group.setBudgetCents(budget);
                changes.add(budget == null ? "removed the budget"
                    : "set the budget to " + CurrencyUtil.formatCents(budget, group.getCurrencyCode()));
            }
        }
        if (request.currencyCode() != null && !CurrencyUtil.normalize(request.currencyCode()).equals(group.getCurrencyCode())) {
            access.requireAdmin(groupId, currentUserId);
            if (expenseRepository.existsActiveByGroupId(groupId) || settlementRepository.existsByGroupId(groupId)) {
                throw new ConflictException("The currency can only be changed before any expenses or settlements are added");
            }
            group.setCurrencyCode(request.currencyCode());
            changes.add("changed the currency to " + group.getCurrencyCode());
        }

        Activity.Type type = Activity.Type.GROUP_UPDATED;
        if (request.archived() != null && request.archived() != group.isArchived()) {
            group.setArchived(request.archived());
            type = request.archived() ? Activity.Type.GROUP_ARCHIVED : Activity.Type.GROUP_RESTORED;
            changes.add(request.archived() ? "archived the group" : "restored the group");
        }

        if (!changes.isEmpty()) {
            group.setUpdatedAt(Instant.now());
            groupRepository.save(group);
            activityService.record(group, actor, type, actor.getFirstName() + " " + String.join(", ", changes), null);
            events.publishGroupEvent(groupId, "GROUP_UPDATED", currentUserId, groupId);
        }
        return getGroupDetails(groupId, currentUserId);
    }

    @Transactional
    public void deleteGroup(UUID groupId, UUID currentUserId) {
        Group group = access.requireAdmin(groupId, currentUserId).getGroup();
        settlementRepository.deleteByGroupId(groupId);
        activityRepository.deleteByGroupId(groupId);
        groupRepository.delete(group);
        events.publishGroupEvent(groupId, "GROUP_DELETED", currentUserId, groupId);
    }

    // ---------------------------------------------------------------- membership

    @Transactional
    public GroupMemberDto addMemberByEmail(UUID groupId, UUID currentUserId, String email) {
        GroupMember me = access.requireMember(groupId, currentUserId);
        Group group = me.getGroup();
        User user = findOrCreatePlaceholder(email.trim().toLowerCase(Locale.ROOT), group.getCurrencyCode());

        if (groupMemberRepository.existsByGroupIdAndUserId(groupId, user.getId())) {
            throw new ConflictException("That person is already a member of this group");
        }
        GroupMember member = groupMemberRepository.save(new GroupMember(group, user, ROLE_MEMBER));
        activityService.record(group, me.getUser(), Activity.Type.MEMBER_ADDED,
            me.getUser().getFirstName() + " added " + user.getFullName(), null);
        events.publishGroupEvent(groupId, "MEMBER_JOINED", currentUserId, user.getId());
        return GroupMemberDto.fromEntity(member, group.getCurrencyCode(), 0L);
    }

    /** Removes a member (admin) or leaves the group (self). Requires a settled balance. */
    @Transactional
    public void removeMember(UUID groupId, UUID currentUserId, UUID targetUserId) {
        GroupMember me = access.requireMember(groupId, currentUserId);
        boolean leaving = currentUserId.equals(targetUserId);
        if (!leaving) {
            access.requireAdmin(groupId, currentUserId);
        }
        GroupMember target = leaving ? me : groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new NotFoundException("Member not found"));

        long balance = balanceService.netBalances(groupId).getOrDefault(targetUserId, 0L);
        if (balance != 0) {
            throw new ConflictException((leaving ? "You need" : target.getUser().getFirstName() + " needs")
                + " to settle up (balance " + CurrencyUtil.formatCents(balance, me.getGroup().getCurrencyCode())
                + ") before leaving the group");
        }

        long memberCount = groupMemberRepository.countByGroupId(groupId);
        if (ROLE_ADMIN.equals(target.getRole()) && memberCount > 1
                && groupMemberRepository.countByGroupIdAndRole(groupId, ROLE_ADMIN) == 1) {
            throw new ConflictException("Make another member an admin first");
        }

        Group group = me.getGroup();
        groupMemberRepository.delete(target);
        if (memberCount == 1) {
            settlementRepository.deleteByGroupId(groupId);
            activityRepository.deleteByGroupId(groupId);
            groupRepository.delete(group);
            return;
        }
        activityService.record(group, me.getUser(),
            leaving ? Activity.Type.MEMBER_LEFT : Activity.Type.MEMBER_REMOVED,
            leaving ? me.getUser().getFirstName() + " left the group"
                : me.getUser().getFirstName() + " removed " + target.getUser().getFullName(), null);
        events.publishGroupEvent(groupId, "MEMBER_LEFT", currentUserId, targetUserId);
    }

    @Transactional
    public GroupMemberDto updateMemberRole(UUID groupId, UUID currentUserId, UUID targetUserId, String role) {
        GroupMember me = access.requireAdmin(groupId, currentUserId);
        GroupMember target = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
            .orElseThrow(() -> new NotFoundException("Member not found"));
        if (target.getRole().equals(role)) {
            return GroupMemberDto.fromEntity(target, me.getGroup().getCurrencyCode(), null);
        }
        if (ROLE_MEMBER.equals(role) && groupMemberRepository.countByGroupIdAndRole(groupId, ROLE_ADMIN) == 1) {
            throw new ConflictException("A group needs at least one admin");
        }
        target.setRole(role);
        groupMemberRepository.save(target);
        activityService.record(me.getGroup(), me.getUser(), Activity.Type.ROLE_CHANGED,
            me.getUser().getFirstName() + (ROLE_ADMIN.equals(role) ? " made " : " removed admin rights from ")
                + target.getUser().getFullName() + (ROLE_ADMIN.equals(role) ? " an admin" : ""), null);
        events.publishGroupEvent(groupId, "MEMBER_UPDATED", currentUserId, targetUserId);
        Long balance = balanceService.netBalances(groupId).get(targetUserId);
        return GroupMemberDto.fromEntity(target, me.getGroup().getCurrencyCode(), balance);
    }

    @Transactional
    public GroupDto joinGroupByInviteCode(UUID currentUserId, String inviteCode) {
        Group group = findByInviteCode(inviteCode);
        User user = requireUser(currentUserId);
        if (!groupMemberRepository.existsByGroupIdAndUserId(group.getId(), currentUserId)) {
            groupMemberRepository.save(new GroupMember(group, user, ROLE_MEMBER));
            activityService.record(group, user, Activity.Type.MEMBER_JOINED, user.getFirstName() + " joined via invite link", null);
            events.publishGroupEvent(group.getId(), "MEMBER_JOINED", currentUserId, currentUserId);
        }
        return getGroupDetails(group.getId(), currentUserId);
    }

    /** Side-effect free: lets the invite screen show what is being joined. */
    @Transactional(readOnly = true)
    public InvitePreviewDto previewInvite(UUID currentUserId, String inviteCode) {
        Group group = findByInviteCode(inviteCode);
        boolean member = groupMemberRepository.existsByGroupIdAndUserId(group.getId(), currentUserId);
        return new InvitePreviewDto(group.getInviteCode(), group.getName(), group.getGroupType(), group.getCurrencyCode(),
            groupMemberRepository.countByGroupId(group.getId()), member, member ? group.getId() : null);
    }

    @Transactional
    public GroupDto regenerateInviteCode(UUID groupId, UUID currentUserId) {
        GroupMember me = access.requireAdmin(groupId, currentUserId);
        Group group = me.getGroup();
        group.setInviteCode(uniqueInviteCode());
        groupRepository.save(group);
        activityService.record(group, me.getUser(), Activity.Type.INVITE_RESET,
            me.getUser().getFirstName() + " reset the invite link", null);
        return getGroupDetails(groupId, currentUserId);
    }

    // ---------------------------------------------------------------- helpers

    private Group findByInviteCode(String inviteCode) {
        if (inviteCode == null || inviteCode.isBlank()) {
            throw new IllegalArgumentException("Invite code cannot be empty");
        }
        return groupRepository.findByInviteCodeIgnoreCase(inviteCode.trim().toUpperCase(Locale.ROOT))
            .orElseThrow(() -> new NotFoundException("This invite code is not valid"));
    }

    private User findOrCreatePlaceholder(String email, String currency) {
        return userRepository.findByEmail(email)
            .orElseGet(() -> userRepository.save(User.placeholder(email, currency)));
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
    }

    private String uniqueInviteCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            String code = Group.generateInviteCode();
            if (!groupRepository.existsByInviteCode(code)) return code;
        }
        throw new IllegalStateException("Could not generate a unique invite code");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
