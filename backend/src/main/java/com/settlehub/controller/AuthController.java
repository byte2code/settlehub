package com.settlehub.controller;

import com.settlehub.dto.*;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final com.settlehub.service.EmailVerificationService emailVerificationService;

    public AuthController(AuthService authService, com.settlehub.service.EmailVerificationService emailVerificationService) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
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
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal UserPrincipal principal,
                                               @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(principal.getId(), request);
        return ResponseEntity.noContent().build();
    }
}
