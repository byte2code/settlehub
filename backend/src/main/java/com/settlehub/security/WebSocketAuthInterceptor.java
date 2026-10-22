package com.settlehub.security;

import com.settlehub.service.GroupAccessService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authenticates STOMP CONNECT frames with the same JWT as the REST API and only lets
 * members subscribe to /topic/groups/{groupId}. Clients cannot publish (no /app handlers).
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final Pattern GROUP_TOPIC = Pattern.compile("^/topic/groups/([0-9a-fA-F-]{36})$");

    private final JwtTokenProvider tokenProvider;
    private final CustomUserDetailsService userDetailsService;
    private final GroupAccessService groupAccessService;

    public WebSocketAuthInterceptor(JwtTokenProvider tokenProvider,
                                    CustomUserDetailsService userDetailsService,
                                    GroupAccessService groupAccessService) {
        this.tokenProvider = tokenProvider;
        this.userDetailsService = userDetailsService;
        this.groupAccessService = groupAccessService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT) {
            String token = JwtAuthenticationFilter.extractBearer(accessor.getFirstNativeHeader("Authorization"));
            UUID userId = tokenProvider.parseUserId(token)
                .orElseThrow(() -> new MessageDeliveryException("Unauthorized"));
            UserPrincipal principal = userDetailsService.loadUserById(userId);
            accessor.setUser(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
        } else if (command == StompCommand.SUBSCRIBE) {
            UUID userId = currentUserId(accessor.getUser());
            Matcher matcher = GROUP_TOPIC.matcher(String.valueOf(accessor.getDestination()));
            if (!matcher.matches() || !groupAccessService.isMember(UUID.fromString(matcher.group(1)), userId)) {
                throw new MessageDeliveryException("Forbidden subscription");
            }
        } else if (command == StompCommand.SEND) {
            throw new MessageDeliveryException("Publishing is not supported");
        }
        return message;
    }

    private static UUID currentUserId(Principal user) {
        if (user instanceof UsernamePasswordAuthenticationToken auth && auth.getPrincipal() instanceof UserPrincipal p) {
            return p.getId();
        }
        throw new MessageDeliveryException("Unauthorized");
    }
}
