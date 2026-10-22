package com.settlehub.controller;

import com.settlehub.dto.*;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.ActivityService;
import com.settlehub.service.GroupService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/groups")
public class GroupController {

    private final GroupService groupService;
    private final ActivityService activityService;

    public GroupController(GroupService groupService, ActivityService activityService) {
        this.groupService = groupService;
        this.activityService = activityService;
    }

    @PostMapping
    public ResponseEntity<GroupDto> createGroup(@AuthenticationPrincipal UserPrincipal principal,
                                                @Valid @RequestBody CreateGroupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.createGroup(principal.getId(), request));
    }

    @GetMapping
    public List<GroupDto> getUserGroups(@AuthenticationPrincipal UserPrincipal principal) {
        return groupService.getUserGroups(principal.getId());
    }

    @GetMapping("/{id}")
    public GroupDto getGroupDetails(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal principal) {
        return groupService.getGroupDetails(id, principal.getId());
    }

    @PutMapping("/{id}")
    public GroupDto updateGroupSettings(@PathVariable("id") UUID id,
                                        @AuthenticationPrincipal UserPrincipal principal,
                                        @Valid @RequestBody UpdateGroupRequest request) {
        return groupService.updateGroupSettings(id, principal.getId(), request);
    }

    @DeleteMapping("/{id}")
    public Map<String, Boolean> deleteGroup(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal principal) {
        groupService.deleteGroup(id, principal.getId());
        return Map.of("success", true);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<GroupMemberDto> addMember(@PathVariable("id") UUID id,
                                                    @AuthenticationPrincipal UserPrincipal principal,
                                                    @Valid @RequestBody AddMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(groupService.addMemberByEmail(id, principal.getId(), request.email()));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public Map<String, Boolean> removeMember(@PathVariable("id") UUID id,
                                             @PathVariable("userId") UUID userId,
                                             @AuthenticationPrincipal UserPrincipal principal) {
        groupService.removeMember(id, principal.getId(), userId);
        return Map.of("success", true);
    }

    @PatchMapping("/{id}/members/{userId}")
    public GroupMemberDto updateMemberRole(@PathVariable("id") UUID id,
                                           @PathVariable("userId") UUID userId,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @Valid @RequestBody UpdateRoleRequest request) {
        return groupService.updateMemberRole(id, principal.getId(), userId, request.role());
    }

    @PostMapping("/{id}/leave")
    public Map<String, Boolean> leaveGroup(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal principal) {
        groupService.removeMember(id, principal.getId(), principal.getId());
        return Map.of("success", true);
    }

    @PostMapping("/{id}/invite-code")
    public GroupDto regenerateInviteCode(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal principal) {
        return groupService.regenerateInviteCode(id, principal.getId());
    }

    @GetMapping("/{id}/activity")
    public List<ActivityDto> getActivity(@PathVariable("id") UUID id,
                                         @AuthenticationPrincipal UserPrincipal principal,
                                         @RequestParam(value = "before", required = false) Instant before,
                                         @RequestParam(value = "limit", defaultValue = "30") int limit) {
        return activityService.list(id, principal.getId(), before, limit);
    }

    @PostMapping("/join")
    public GroupDto joinGroup(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody JoinGroupRequest request) {
        return groupService.joinGroupByInviteCode(principal.getId(), request.inviteCode());
    }

    /** Preview only; joining always requires POST /join. */
    @GetMapping("/invite/{code}")
    public InvitePreviewDto previewInvite(@PathVariable("code") String code, @AuthenticationPrincipal UserPrincipal principal) {
        return groupService.previewInvite(principal.getId(), code);
    }
}
