package com.settlehub.service;

import com.settlehub.dto.*;
import com.settlehub.model.User;
import com.settlehub.repository.UserRepository;
import com.settlehub.util.CurrencyUtil;
import com.settlehub.security.JwtTokenProvider;
import com.settlehub.security.UserPrincipal;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email().trim().toLowerCase())) {
            throw new IllegalArgumentException("Email is already registered: " + request.email());
        }

        User user = new User(
            request.email().trim().toLowerCase(),
            passwordEncoder.encode(request.password()),
            request.firstName().trim(),
            request.lastName() != null ? request.lastName().trim() : "",
            request.currencyCode() != null && !request.currencyCode().isBlank() ? request.currencyCode().trim().toUpperCase() : CurrencyUtil.DEFAULT_CURRENCY
        );

        User savedUser = userRepository.save(user);
        UserPrincipal principal = UserPrincipal.create(savedUser);
        String token = tokenProvider.generateToken(principal);

        return new AuthResponse(token, UserDto.fromEntity(savedUser));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.email().trim().toLowerCase(),
                request.password()
            )
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        String token = tokenProvider.generateToken(principal);

        User user = userRepository.findById(principal.getId())
            .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return new AuthResponse(token, UserDto.fromEntity(user));
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserDto.fromEntity(user);
    }

    @Transactional
    public UserDto updateUserCurrency(UUID userId, String currencyCode) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (currencyCode != null && !currencyCode.isBlank()) {
            user.setCurrencyCode(currencyCode.trim().toUpperCase());
            user = userRepository.save(user);
        }
        return UserDto.fromEntity(user);
    }
}
