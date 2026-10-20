package com.settlehub.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class WebSocketEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventPublisher.class);

    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishGroupEvent(UUID groupId, String eventType, Object payload) {
        if (groupId == null) return;
        try {
            Map<String, Object> message = Map.of(
                "type", eventType,
                "groupId", groupId.toString(),
                "timestamp", Instant.now().toString(),
                "data", payload != null ? payload : Map.of()
            );
            messagingTemplate.convertAndSend("/topic/groups/" + groupId, message);
            log.debug("Published WebSocket event {} for group {}", eventType, groupId);
        } catch (Exception e) {
            log.warn("Failed to broadcast WebSocket event for group {}: {}", groupId, e.getMessage());
        }
    }
}
