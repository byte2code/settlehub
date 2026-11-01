package com.settlehub.service;

import com.settlehub.dto.*;
import com.settlehub.exception.BadRequestException;
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
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final EmailVerificationService emailVerificationService;
    private final AdminEmailPolicy adminEmailPolicy;
    private final GoogleIdentityVerifier googleVerifier;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider,
                       EmailVerificationService emailVerificationService,
                       AdminEmailPolicy adminEmailPolicy, GoogleIdentityVerifier googleVerifier) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.emailVerificationService = emailVerificationService;
        this.adminEmailPolicy = adminEmailPolicy;
        this.googleVerifier = googleVerifier;
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

        // Check if an active account already exists before checking OTP
        Optional<User> existingUser = userRepository.findByEmail(email);
        if (existingUser.isPresent() && !existingUser.get().isPlaceholder()) {
            throw new ConflictException("An account with this email already exists. Try signing in.");
        }

        // Enforce email verification if required and not bypassed
        emailVerificationService.validateRegistrationOtp(email, request.otp());

        User user = existingUser.map(existing -> {
            existing.setPlaceholder(false);
            existing.setPassword(passwordEncoder.encode(request.password()));
            existing.setFirstName(firstName);
            existing.setLastName(lastName);
            existing.setCurrencyCode(currency);
            return existing;
        }).orElseGet(() -> new User(email, passwordEncoder.encode(request.password()), firstName, lastName, currency));

        user.setAdmin(adminEmailPolicy.isAdmin(email));
        User saved = userRepository.save(user);
        return new AuthResponse(tokenProvider.generateToken(UserPrincipal.create(saved)), UserDto.fromEntity(saved));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email().trim().toLowerCase(Locale.ROOT), request.password()));
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = requireUser(principal.getId());
        // APP_ADMIN_EMAILS is the single source of truth, so removing an email revokes admin at next sign-in
        boolean admin = adminEmailPolicy.isAdmin(user.getEmail());
        if (user.isAdmin() != admin) {
            user.setAdmin(admin);
            user = userRepository.save(user);
        }
        return new AuthResponse(tokenProvider.generateToken(UserPrincipal.create(user)), UserDto.fromEntity(user));
    }

    public boolean googleEnabled() { return googleVerifier.configured(); }

    /**
     * Sign in (or sign up) with a Google ID token. Google must have verified the email; that is what makes it safe to
     * link to an existing account or claim an invited placeholder with the same address.
     */
    @Transactional
    public AuthResponse googleSignIn(String idToken) {
        if (!googleVerifier.configured()) throw new BadRequestException("Google sign-in is not set up on this server");
        GoogleIdentityVerifier.GoogleIdentity identity = googleVerifier.verify(idToken)
            .orElseThrow(() -> new org.springframework.security.authentication.BadCredentialsException("Invalid Google sign-in"));
        String email = identity.email().trim().toLowerCase(Locale.ROOT);
        String firstName = identity.givenName() == null || identity.givenName().isBlank() ? email.split("@")[0] : identity.givenName();
        String lastName = identity.familyName() == null ? "" : identity.familyName();

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            user = new User(email, passwordEncoder.encode(java.util.UUID.randomUUID() + java.util.UUID.randomUUID().toString()), firstName, lastName, CurrencyUtil.DEFAULT_CURRENCY);
            user.setPasswordLogin(false);
        } else if (user.isPlaceholder()) {
            user.setPlaceholder(false);
            user.setFirstName(firstName);
            user.setLastName(lastName);
            user.setPasswordLogin(false);
            user.setPassword(passwordEncoder.encode(java.util.UUID.randomUUID() + java.util.UUID.randomUUID().toString()));
        } else if (!user.isActive()) {
            throw new org.springframework.security.authentication.LockedException("deactivated");
        }
        user.setAdmin(adminEmailPolicy.isAdmin(email));
        User saved = userRepository.save(user);
        return new AuthResponse(tokenProvider.generateToken(UserPrincipal.create(saved)), UserDto.fromEntity(saved));
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
        if (request.bio() != null) {
            user.setBio(request.bio().isBlank() ? null : request.bio().trim());
        }
        if (request.avatarId() != null) {
            user.setAvatarId(request.avatarId().isBlank() ? null : request.avatarId());
        }
        if (request.chimeSound() != null) {
            user.setChimeSound(request.chimeSound().isBlank() ? null : request.chimeSound());
        }
        return UserDto.fromEntity(userRepository.save(user));
    }

    @Transactional
    public UserDto updateUserCurrency(UUID userId, String currencyCode) {
        return updateProfile(userId, new UpdateProfileRequest(null, null, currencyCode, null, null, null, null));
    }

    /** Changing the password signs out every other device; the caller gets a fresh token for this one. */
    @Transactional
    public String changePassword(UUID userId, ChangePasswordRequest request) {
        User user = requireUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setPasswordLogin(true);
        user.bumpTokenVersion();
        return tokenProvider.generateToken(UserPrincipal.create(userRepository.save(user)));
    }

    /** "Sign out other devices": old tokens stop working, the caller keeps a new one. */
    @Transactional
    public String revokeOtherSessions(UUID userId) {
        User user = requireUser(userId);
        user.bumpTokenVersion();
        return tokenProvider.generateToken(UserPrincipal.create(userRepository.save(user)));
    }

    @Transactional
    public SendOtpResponse forgotPassword(ForgotPasswordRequest request) {
        return emailVerificationService.sendPasswordResetOtp(request.email());
    }

    @Transactional
    public AuthResponse resetPassword(ResetPasswordRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        emailVerificationService.validatePasswordResetOtp(email, request.otp());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("User not found"));
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setPasswordLogin(true);
        user.bumpTokenVersion(); // a reset signs out any device that may have been compromised
        user.setAdmin(adminEmailPolicy.isAdmin(email));
        User saved = userRepository.save(user);

        return new AuthResponse(tokenProvider.generateToken(UserPrincipal.create(saved)), UserDto.fromEntity(saved));
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
    }
}
