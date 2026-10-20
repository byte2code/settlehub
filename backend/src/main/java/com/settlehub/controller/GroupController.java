package com.settlehub.controller;

import com.settlehub.dto.CreateGroupRequest;
import com.settlehub.dto.GroupDto;
import com.settlehub.dto.GroupMemberDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/groups")
@CrossOrigin(originPatterns = "*", allowedHeaders = "*")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ResponseEntity<GroupDto> createGroup(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody CreateGroupRequest request
    ) {
        GroupDto group = groupService.createGroup(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(group);
    }

    @GetMapping
    public ResponseEntity<List<GroupDto>> getUserGroups(@AuthenticationPrincipal UserPrincipal principal) {
        List<GroupDto> groups = groupService.getUserGroups(principal.getId());
        return ResponseEntity.ok(groups);
    }

    @GetMapping("/{id}")
    public ResponseEntity<GroupDto> getGroupDetails(
        @PathVariable("id") UUID id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        GroupDto group = groupService.getGroupDetails(id, principal.getId());
        return ResponseEntity.ok(group);
    }

    @PutMapping("/{id}")
    public ResponseEntity<GroupDto> updateGroupSettings(
        @PathVariable("id") UUID id,
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestBody Map<String, Object> body
    ) {
        String name = (String) body.get("name");
        Boolean simplify = (Boolean) body.get("simplifyByDefault");
        Boolean archived = (Boolean) body.get("archived");
        Long budgetCents = null;
        if (body.get("budgetCents") != null) {
            budgetCents = ((Number) body.get("budgetCents")).longValue();
        }
        GroupDto updated = groupService.updateGroupSettings(id, principal.getId(), name, simplify, archived, budgetCents);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Boolean>> deleteGroup(
        @PathVariable("id") UUID id,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        groupService.deleteGroup(id, principal.getId());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<GroupMemberDto> addMember(
        @PathVariable("id") UUID id,
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestBody Map<String, String> body
    ) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required to add member.");
        }
        GroupMemberDto member = groupService.addMemberByEmail(id, principal.getId(), email);
        return ResponseEntity.status(HttpStatus.CREATED).body(member);
    }

    @PostMapping("/join")
    public ResponseEntity<GroupDto> joinGroup(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestBody Map<String, String> body
    ) {
        String inviteCode = body.get("inviteCode");
        if (inviteCode == null || inviteCode.isBlank()) {
            throw new IllegalArgumentException("Invite code is required.");
        }
        GroupDto group = groupService.joinGroupByInviteCode(principal.getId(), inviteCode);
        return ResponseEntity.ok(group);
    }

    @GetMapping("/invite/{code}")
    public ResponseEntity<GroupDto> getGroupByInviteCode(
        @PathVariable("code") String code,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        GroupDto group = groupService.joinGroupByInviteCode(principal.getId(), code);
        return ResponseEntity.ok(group);
    }
}
