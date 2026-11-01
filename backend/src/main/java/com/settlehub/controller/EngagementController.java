package com.settlehub.controller;

import com.settlehub.dto.EngagementDtos.*;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.EngagementService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class EngagementController {

    private final EngagementService service;

    public EngagementController(EngagementService service) {
        this.service = service;
    }

    @GetMapping("/groups/{groupId}/engagement")
    public Map<UUID, Engagement> engagement(@PathVariable("groupId") UUID groupId, @AuthenticationPrincipal UserPrincipal p) {
        return service.forGroup(groupId, p.getId());
    }

    @PutMapping("/expenses/{id}/reactions")
    public Engagement react(@PathVariable("id") UUID id, @RequestBody ReactionRequest body, @AuthenticationPrincipal UserPrincipal p) {
        return service.toggleReaction(id, p.getId(), body.emoji());
    }

    @GetMapping("/expenses/{id}/comments")
    public List<CommentDto> comments(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal p) {
        return service.comments(id, p.getId());
    }

    @PostMapping("/expenses/{id}/comments")
    public ResponseEntity<CommentDto> comment(@PathVariable("id") UUID id, @RequestBody CommentRequest body, @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addComment(id, p.getId(), body.body()));
    }

    @DeleteMapping("/comments/{id}")
    public Map<String, Boolean> delete(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal p) {
        service.deleteComment(id, p.getId());
        return Map.of("success", true);
    }
}
