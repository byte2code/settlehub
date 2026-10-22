package com.settlehub.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Broadcasts small "something changed" events to /topic/groups/{groupId}.
 * Events are sent only after the surrounding transaction commits, so clients that refetch
 * always see the new data. Payloads carry ids only; clients load details through the
 * authorized REST API.
 */
@Service
public class WebSocketEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventPublisher.class);

    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publishGroupEvent(UUID groupId, String eventType, UUID actorId, UUID entityId) {
        if (groupId == null) return;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", eventType);
        message.put("groupId", groupId.toString());
        message.put("actorId", actorId != null ? actorId.toString() : null);
        message.put("entityId", entityId != null ? entityId.toString() : null);
        message.put("timestamp", Instant.now().toString());

        Runnable send = () -> {
            try {
                messagingTemplate.convertAndSend("/topic/groups/" + groupId, (Object) message);
            } catch (Exception e) {
                log.warn("Failed to broadcast WebSocket event for group {}: {}", groupId, e.getMessage());
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }
}
