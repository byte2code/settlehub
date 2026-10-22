package com.settlehub.service;

import com.settlehub.dto.ActivityDto;
import com.settlehub.model.Activity;
import com.settlehub.model.Group;
import com.settlehub.model.User;
import com.settlehub.repository.ActivityRepository;
import com.settlehub.dto.GroupDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class ActivityService {

    private static final int MAX_PAGE = 100;

    private final ActivityRepository activityRepository;
    private final GroupAccessService groupAccessService;

    public ActivityService(ActivityRepository activityRepository, GroupAccessService groupAccessService) {
        this.activityRepository = activityRepository;
        this.groupAccessService = groupAccessService;
    }

    @Transactional
    public void record(Group group, User actor, Activity.Type type, String summary, Long amountCents) {
        activityRepository.save(new Activity(group.getId(), actor, type, summary, amountCents));
    }

    @Transactional(readOnly = true)
    public List<ActivityDto> list(UUID groupId, UUID userId, Instant before, int limit) {
        Group group = groupAccessService.requireGroup(groupId, userId);
        int size = Math.max(1, Math.min(limit, MAX_PAGE));
        String currency = GroupDto.currencyOf(group);
        return activityRepository.findPage(groupId, before != null ? before : Instant.now().plusSeconds(1), PageRequest.of(0, size))
            .stream()
            .map(a -> ActivityDto.fromEntity(a, currency))
            .toList();
    }
}
