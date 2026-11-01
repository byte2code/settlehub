package com.settlehub.controller;

import com.settlehub.dto.RecurringDtos.CreateRequest;
import com.settlehub.dto.RecurringDtos.RecurringDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.RecurringService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class RecurringController {

    private final RecurringService service;

    public RecurringController(RecurringService service) {
        this.service = service;
    }

    @GetMapping("/groups/{groupId}/recurring")
    public List<RecurringDto> list(@PathVariable("groupId") UUID groupId, @AuthenticationPrincipal UserPrincipal p) {
        return service.list(groupId, p.getId());
    }

    @PostMapping("/groups/{groupId}/recurring")
    public ResponseEntity<RecurringDto> create(@PathVariable("groupId") UUID groupId, @Valid @RequestBody CreateRequest body, @AuthenticationPrincipal UserPrincipal p) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(groupId, p.getId(), body));
    }

    @PostMapping("/groups/{groupId}/recurring/run")
    public Map<String, Integer> run(@PathVariable("groupId") UUID groupId, @AuthenticationPrincipal UserPrincipal p) {
        return Map.of("generated", service.runForGroup(groupId, p.getId()));
    }

    @DeleteMapping("/recurring/{id}")
    public Map<String, Boolean> delete(@PathVariable("id") UUID id, @AuthenticationPrincipal UserPrincipal p) {
        service.delete(id, p.getId());
        return Map.of("success", true);
    }
}
