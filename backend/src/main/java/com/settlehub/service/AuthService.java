package com.settlehub.service;

import com.settlehub.dto.*;
import com.settlehub.exception.ConflictException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.User;
import com.settlehub.repository.UserRepository;
import com.settlehub.security.JwtTokenProvider;
import com.settlehub.security.UserPrincipal;
import com.settlehub.util.CurrencyUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
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

    /**
     * Creates an account, or claims the placeholder account created when someone added this
     * email to a group, so the new user immediately sees those groups and balances.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String currency = request.currencyCode() != null && !request.currencyCode().isBlank()
            ? CurrencyUtil.normalize(request.currencyCode()) : CurrencyUtil.DEFAULT_CURRENCY;
        String firstName = request.firstName().trim();
        String lastName = request.lastName() != null ? request.lastName().trim() : "";

        User user = userRepository.findByEmail(email).map(existing -> {
            if (!existing.isPlaceholder()) {
                throw new ConflictException("An account with this email already exists. Try signing in.");
            }
            existing.setPlaceholder(false);
            existing.setPassword(passwordEncoder.encode(request.password()));
            existing.setFirstName(firstName);
            existing.setLastName(lastName);
            existing.setCurrencyCode(currency);
            return existing;
        }).orElseGet(() -> new User(email, passwordEncoder.encode(request.password()), firstName, lastName, currency));

        User saved = userRepository.save(user);
        return new AuthResponse(tokenProvider.generateToken(UserPrincipal.create(saved)), UserDto.fromEntity(saved));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(Locale.ROOT), request.password()));
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return new AuthResponse(tokenProvider.generateToken(principal), getCurrentUser(principal.getId()));
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(UUID userId) {
        return UserDto.fromEntity(requireUser(userId));
    }

    @Transactional
    public UserDto updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = requireUser(userId);
        if (request.firstName() != null && !request.firstName().isBlank()) {
            user.setFirstName(request.firstName().trim());
        }
        if (request.lastName() != null) {
            user.setLastName(request.lastName().trim());
        }
        if (request.currencyCode() != null && !request.currencyCode().isBlank()) {
            user.setCurrencyCode(CurrencyUtil.normalize(request.currencyCode()));
        }
        if (request.upiId() != null) {
            user.setUpiId(request.upiId().isBlank() ? null : request.upiId().trim());
        }
        return UserDto.fromEntity(userRepository.save(user));
    }

    @Transactional
    public UserDto updateUserCurrency(UUID userId, String currencyCode) {
        return updateProfile(userId, new UpdateProfileRequest(null, null, currencyCode, null));
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = requireUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
