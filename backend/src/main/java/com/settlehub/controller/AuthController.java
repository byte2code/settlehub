package com.settlehub.controller;

import com.settlehub.dto.*;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final com.settlehub.service.EmailVerificationService emailVerificationService;
    private final com.settlehub.service.BadgeService badgeService;
    private final com.settlehub.service.AccountService accountService;

    public AuthController(AuthService authService, com.settlehub.service.EmailVerificationService emailVerificationService,
                          com.settlehub.service.BadgeService badgeService,
                          com.settlehub.service.AccountService accountService) {
        this.accountService = accountService;
        this.authService = authService;
        this.badgeService = badgeService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/google")
    public AuthResponse google(@RequestBody Map<String, String> body) {
        return authService.googleSignIn(body.get("idToken"));
    }

    @GetMapping("/config")
    public Map<String, Object> authConfig() {
        return Map.of("googleEnabled", authService.googleEnabled());
    }

    @PostMapping("/send-otp")
    public SendOtpResponse sendOtp(@Valid @RequestBody SendOtpRequest request) {
        return emailVerificationService.sendOtp(request.email());
    }

    @PostMapping("/verify-otp")
    public Map<String, Object> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        boolean valid = emailVerificationService.verifyOtp(request.email(), request.code());
        return Map.of("success", valid, "message", "Email verified successfully");
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public UserDto getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        return authService.getCurrentUser(principal.getId());
    }

    @GetMapping("/me/badges")
    public List<BadgeDto> getBadges(@AuthenticationPrincipal UserPrincipal principal) {
        return badgeService.badgesFor(principal.getId());
    }

    @PatchMapping("/me")
    public UserDto updateProfile(@AuthenticationPrincipal UserPrincipal principal,
                                 @Valid @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile(principal.getId(), request);
    }

    /** 2.0-compatible shortcut for changing only the default currency. */
    @PatchMapping("/me/currency")
    public UserDto updateCurrency(@AuthenticationPrincipal UserPrincipal principal,
                                  @RequestBody Map<String, String> body) {
        return authService.updateUserCurrency(principal.getId(), body.get("currencyCode"));
    }

    @PostMapping("/me/password")
    public Map<String, String> changePassword(@AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody ChangePasswordRequest request) {
        return Map.of("token", authService.changePassword(principal.getId(), request));
    }

    @GetMapping("/me/export")
    public Map<String, Object> export(@AuthenticationPrincipal UserPrincipal principal) {
        return accountService.export(principal.getId());
    }

    @DeleteMapping("/me")
    public Map<String, Boolean> deleteAccount(@AuthenticationPrincipal UserPrincipal principal, @RequestBody Map<String, String> body) {
        accountService.delete(principal.getId(), body.get("password"), body.get("confirmEmail"));
        return Map.of("success", true);
    }

    @PostMapping("/me/sessions/revoke-others")
    public Map<String, String> revokeOtherSessions(@AuthenticationPrincipal UserPrincipal principal) {
        return Map.of("token", authService.revokeOtherSessions(principal.getId()));
    }

    @PostMapping("/forgot-password")
    public SendOtpResponse forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return authService.forgotPassword(request);
    }

    @PostMapping("/reset-password")
    public AuthResponse resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }
}
