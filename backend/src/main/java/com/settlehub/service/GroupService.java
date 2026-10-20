package com.settlehub.service;

import com.settlehub.dto.CreateGroupRequest;
import com.settlehub.dto.GroupDto;
import com.settlehub.dto.GroupMemberDto;
import com.settlehub.model.Group;
import com.settlehub.model.GroupMember;
import com.settlehub.model.User;
import com.settlehub.repository.GroupMemberRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.UserRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final BalanceService balanceService;

    public GroupService(GroupRepository groupRepository,
                        GroupMemberRepository groupMemberRepository,
                        UserRepository userRepository,
                        BalanceService balanceService) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.userRepository = userRepository;
        this.balanceService = balanceService;
    }

    @Transactional
    public GroupDto createGroup(UUID currentUserId, CreateGroupRequest request) {
        User creator = userRepository.findById(currentUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + currentUserId));

        boolean simplify = request.simplifyByDefault() == null || request.simplifyByDefault();
        String currency = (request.currencyCode() != null && !request.currencyCode().isBlank())
            ? request.currencyCode().trim().toUpperCase()
            : (creator.getCurrencyCode() != null ? creator.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY);
        Group group = new Group(request.name().trim(), request.groupType(), simplify, currency);
        if (request.budgetCents() != null && request.budgetCents() > 0) {
            group.setBudgetCents(request.budgetCents());
        }
        group = groupRepository.save(group);

        // Creator is added as ADMIN
        GroupMember creatorMember = new GroupMember(group, creator, "ADMIN");
        groupMemberRepository.save(creatorMember);

        // Add additional members by email if specified
        if (request.memberEmails() != null) {
            for (String email : request.memberEmails()) {
                String cleanEmail = email.trim().toLowerCase();
                if (cleanEmail.isEmpty() || cleanEmail.equalsIgnoreCase(creator.getEmail())) continue;

                Optional<User> existingUser = userRepository.findByEmail(cleanEmail);
                User memberUser = existingUser.orElseGet(() -> {
                    // Create guest/placeholder account for invited email
                    String localPart = cleanEmail.split("@")[0];
                    User guest = new User(cleanEmail, "", localPart, "", currency);
                    return userRepository.save(guest);
                });

                if (!groupMemberRepository.existsByGroupAndUser(group, memberUser)) {
                    GroupMember member = new GroupMember(group, memberUser, "MEMBER");
                    groupMemberRepository.save(member);
                }
            }
        }

        return getGroupDetails(group.getId(), currentUserId);
    }

    @Transactional(readOnly = true)
    public List<GroupDto> getUserGroups(UUID currentUserId) {
        User user = userRepository.findById(currentUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Group> groups = groupRepository.findAllForUser(user);
        List<GroupDto> dtos = new ArrayList<>();

        for (Group group : groups) {
            Map<UUID, Long> netBalances = balanceService.calculateGroupNetBalances(group);
            Long userBalance = netBalances.getOrDefault(currentUserId, 0L);

            List<GroupMemberDto> memberDtos = groupMemberRepository.findAllByGroup(group).stream()
                .map(m -> GroupMemberDto.fromEntity(m, netBalances.get(m.getUser().getId())))
                .toList();

            dtos.add(GroupDto.fromEntity(group, memberDtos, userBalance));
        }

        return dtos;
    }

    @Transactional(readOnly = true)
    public GroupDto getGroupDetails(UUID groupId, UUID currentUserId) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));

        Map<UUID, Long> netBalances = balanceService.calculateGroupNetBalances(group);
        Long userBalance = netBalances.getOrDefault(currentUserId, 0L);

        List<GroupMemberDto> memberDtos = groupMemberRepository.findAllByGroup(group).stream()
            .map(m -> GroupMemberDto.fromEntity(m, netBalances.get(m.getUser().getId())))
            .toList();

        return GroupDto.fromEntity(group, memberDtos, userBalance);
    }

    @Transactional
    public GroupMemberDto addMemberByEmail(UUID groupId, UUID currentUserId, String email) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        String cleanEmail = email.trim().toLowerCase();
        Optional<User> existingUser = userRepository.findByEmail(cleanEmail);
        User user = existingUser.orElseGet(() -> {
            String localPart = cleanEmail.split("@")[0];
            String groupCurr = group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY;
            User guest = new User(cleanEmail, "", localPart, "", groupCurr);
            return userRepository.save(guest);
        });

        if (groupMemberRepository.existsByGroupAndUser(group, user)) {
            throw new IllegalArgumentException("User is already a member of this group");
        }

        GroupMember member = new GroupMember(group, user, "MEMBER");
        member = groupMemberRepository.save(member);

        return GroupMemberDto.fromEntity(member, 0L);
    }

    @Transactional
    public GroupDto updateGroupSettings(UUID groupId, UUID currentUserId, String name, Boolean simplifyByDefault, Boolean archived, Long budgetCents) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        if (name != null && !name.isBlank()) {
            group.setName(name.trim());
        }
        if (simplifyByDefault != null) {
            group.setSimplifyByDefault(simplifyByDefault);
        }
        if (archived != null) {
            group.setArchived(archived);
        }
        if (budgetCents != null) {
            group.setBudgetCents(budgetCents >= 0 ? budgetCents : null);
        }
        group = groupRepository.save(group);

        return getGroupDetails(group.getId(), currentUserId);
    }

    @Transactional
    public GroupDto updateGroupSettings(UUID groupId, UUID currentUserId, String name, Boolean simplifyByDefault) {
        return updateGroupSettings(groupId, currentUserId, name, simplifyByDefault, null, null);
    }

    @Transactional
    public void deleteGroup(UUID groupId, UUID currentUserId) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        groupRepository.delete(group);
    }

    @Transactional
    public GroupDto joinGroupByInviteCode(UUID currentUserId, String inviteCode) {
        if (inviteCode == null || inviteCode.trim().isEmpty()) {
            throw new IllegalArgumentException("Invite code cannot be empty");
        }
        String cleanCode = inviteCode.trim().toUpperCase();
        Group group = groupRepository.findByInviteCodeIgnoreCase(cleanCode)
            .orElseThrow(() -> new IllegalArgumentException("Invalid invite code: " + cleanCode));

        User user = userRepository.findById(currentUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!groupMemberRepository.existsByGroupAndUser(group, user)) {
            GroupMember member = new GroupMember(group, user, "MEMBER");
            groupMemberRepository.save(member);
        }

        return getGroupDetails(group.getId(), currentUserId);
    }
}
