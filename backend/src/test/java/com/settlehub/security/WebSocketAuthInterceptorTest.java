package com.settlehub.security;

import com.settlehub.service.GroupAccessService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebSocketAuthInterceptorTest {

    private final JwtTokenProvider tokens = new JwtTokenProvider("k".repeat(40), 60_000, "jdbc:h2:mem:x");
    private final CustomUserDetailsService users = mock(CustomUserDetailsService.class);
    private final GroupAccessService access = mock(GroupAccessService.class);
    private final WebSocketAuthInterceptor interceptor = new WebSocketAuthInterceptor(tokens, users, access);
    private final UUID userId = UUID.randomUUID();
    private final UserPrincipal principal = new UserPrincipal(userId, "a@b.c", "x", "A", true, List.of());

    private Message<byte[]> frame(StompCommand command, String authHeader, String destination, boolean authenticated) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        if (authHeader != null) accessor.addNativeHeader("Authorization", authHeader);
        if (destination != null) accessor.setDestination(destination);
        if (authenticated) accessor.setUser(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    @Test
    void connectRequiresValidToken() {
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame(StompCommand.CONNECT, null, null, false), null));
        assertThrows(MessageDeliveryException.class, () -> interceptor.preSend(frame(StompCommand.CONNECT, "Bearer junk", null, false), null));

        when(users.loadUserById(userId)).thenReturn(principal);
        String token = tokens.generateToken(principal);
        assertNotNull(interceptor.preSend(frame(StompCommand.CONNECT, "Bearer " + token, null, false), null));
    }

    @Test
    void subscribeRequiresMembership() {
        UUID mine = UUID.randomUUID();
        UUID theirs = UUID.randomUUID();
        when(access.isMember(mine, userId)).thenReturn(true);
        when(access.isMember(theirs, userId)).thenReturn(false);

        assertNotNull(interceptor.preSend(frame(StompCommand.SUBSCRIBE, null, "/topic/groups/" + mine, true), null));
        assertThrows(MessageDeliveryException.class,
            () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, null, "/topic/groups/" + theirs, true), null));
        assertThrows(MessageDeliveryException.class,
            () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, null, "/topic/other", true), null));
        assertThrows(MessageDeliveryException.class,
            () -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, null, "/topic/groups/" + mine, false), null));
    }

    @Test
    void clientsCannotPublish() {
        assertThrows(MessageDeliveryException.class,
            () -> interceptor.preSend(frame(StompCommand.SEND, null, "/topic/groups/" + UUID.randomUUID(), true), null));
    }
}
