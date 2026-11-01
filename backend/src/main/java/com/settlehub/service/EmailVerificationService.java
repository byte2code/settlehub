package com.settlehub.service;

import com.settlehub.dto.SendOtpResponse;
import com.settlehub.exception.BadRequestException;
import com.settlehub.exception.ConflictException;
import com.settlehub.exception.NotFoundException;
import com.settlehub.model.EmailVerification;
import com.settlehub.model.User;
import com.settlehub.repository.EmailVerificationRepository;
import com.settlehub.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final EmailVerificationRepository verificationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final HttpClient httpClient;
    private final EmailQuotaTracker quotaTracker;

    private final boolean requireEmailVerification;
    private final Set<String> testDomains;
    private final Set<String> bypassEmails;
    private final String masterOtp;
    private final int otpExpiryMinutes;
    private final String brevoApiKey;
    private final String brevoSenderEmail;
    private final String springMailUsername;

    public EmailVerificationService(
            EmailVerificationRepository verificationRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            EmailQuotaTracker quotaTracker,
            @Value("${app.auth.require-email-verification:true}") boolean requireEmailVerification,
            @Value("${app.auth.test-domains:}") String testDomainsStr,
            @Value("${app.auth.master-otp:}") String masterOtp,
            @Value("${app.auth.otp-expiry-minutes:10}") int otpExpiryMinutes,
            @Value("${app.auth.verification-bypass-emails:}") String bypassEmailsStr,
            @Value("${app.mail.brevo-api-key:}") String brevoApiKey,
            @Value("${app.mail.brevo-sender-email:}") String brevoSenderEmail,
            @Value("${spring.mail.username:}") String springMailUsername) {
        this.verificationRepository = verificationRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.quotaTracker = quotaTracker;
        this.requireEmailVerification = requireEmailVerification;
        this.testDomains = parseSet(testDomainsStr);
        this.bypassEmails = parseSet(bypassEmailsStr);
        this.masterOtp = masterOtp != null ? masterOtp.trim() : "";
        this.otpExpiryMinutes = otpExpiryMinutes > 0 ? otpExpiryMinutes : 10;
        this.brevoApiKey = brevoApiKey != null ? brevoApiKey.trim() : "";
        if (!this.masterOtp.isEmpty() && !this.brevoApiKey.isEmpty()) {
            log.warn("app.auth.master-otp is set but ignored because BREVO_API_KEY is configured.");
        }
        if (!this.masterOtp.isEmpty() && this.brevoApiKey.isEmpty()) {
            log.warn("Development master OTP is ENABLED. Never set AUTH_MASTER_OTP in production.");
        }
        this.brevoSenderEmail = brevoSenderEmail != null ? brevoSenderEmail.trim() : "";
        this.springMailUsername = springMailUsername != null ? springMailUsername.trim() : "";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    private static Set<String> parseSet(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        Set<String> set = new HashSet<>();
        for (String s : csv.split(",")) {
            String trimmed = s.trim().toLowerCase(Locale.ROOT);
            if (!trimmed.isEmpty()) set.add(trimmed);
        }
        return Collections.unmodifiableSet(set);
    }

    /** Dev-only escape hatch: needs an explicit non-empty master code AND no Brevo key configured. */
    private boolean matchesDevMaster(String code) {
        return !masterOtp.isEmpty() && brevoApiKey.isEmpty() && masterOtp.equals(code);
    }

    public boolean isBypassed(String email) {
        if (!requireEmailVerification) return true;
        if (email == null || email.isBlank()) return false;
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (bypassEmails.contains(normalized)) return true;
        int atIdx = normalized.lastIndexOf('@');
        if (atIdx != -1 && atIdx < normalized.length() - 1) {
            String domain = normalized.substring(atIdx + 1);
            if (testDomains.contains(domain)) return true;
        }
        return false;
    }

    @Transactional
    public SendOtpResponse sendOtp(String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new BadRequestException("Email is required");
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        // Pre-check: prevent sending OTP if a full account already exists
        userRepository.findByEmail(email).ifPresent(existing -> {
            if (!existing.isPlaceholder()) {
                throw new ConflictException("An account with this email already exists. Try signing in.");
            }
        });

        // Check if bypassed for tests or development
        if (isBypassed(email)) {
            log.info("Email verification bypassed for '{}' (requireVerification={})", email, requireEmailVerification);
            return new SendOtpResponse(true, true, "Email verification bypassed for testing", 0);
        }

        // Cool-down check: must wait at least 60s between codes for the same email
        verificationRepository.findTopByEmailOrderByCreatedAtDesc(email).ifPresent(last -> {
            long elapsedSeconds = Duration.between(last.getCreatedAt(), Instant.now()).getSeconds();
            if (elapsedSeconds < 60) {
                long waitTime = 60 - elapsedSeconds;
                throw new BadRequestException("Please wait " + waitTime + " seconds before requesting another code.");
            }
        });

        // Clean up any older pending codes for this email and purge expired records to keep table lean
        verificationRepository.deleteByEmail(email);
        verificationRepository.deleteExpired(Instant.now());

        // Generate cryptographically secure 6-digit code
        int codeInt = 100000 + SECURE_RANDOM.nextInt(900000);
        String code = String.valueOf(codeInt);

        // Store hashed code with expiry
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(otpExpiryMinutes));
        String otpHash = passwordEncoder.encode(code);
        EmailVerification verification = new EmailVerification(email, otpHash, expiresAt);
        verificationRepository.save(verification);

        // Dispatch email via Brevo REST API
        boolean sent = sendBrevoEmail(email, "Your SettleHub Verification Code: " + code, buildOtpEmailHtml(code));
        if (!sent) {
            if (brevoApiKey.isBlank()) {
                log.warn("BREVO_API_KEY is not configured. Use the development master code for '{}' if enabled.", email);
                return new SendOtpResponse(true, false, "Email service not configured. Use development master code.", otpExpiryMinutes * 60);
            }
            throw new BadRequestException("Could not send verification email. Please check your email address and try again.");
        }

        return new SendOtpResponse(true, false, "Verification code sent to " + email, otpExpiryMinutes * 60);
    }

    @Transactional
    public boolean verifyOtp(String rawEmail, String code) {
        if (rawEmail == null || rawEmail.isBlank() || code == null || code.isBlank()) {
            throw new BadRequestException("Email and verification code are required");
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        String trimmedCode = code.trim();

        if (isBypassed(email)) return true;

        EmailVerification verification = verificationRepository.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new BadRequestException("No verification request found for this email. Please request a new code."));

        if (verification.isExpired()) {
            throw new BadRequestException("Verification code has expired. Please request a new one.");
        }

        if (verification.getAttempts() >= 5) {
            throw new BadRequestException("Too many incorrect attempts. Please request a new code.");
        }

        boolean isDevMaster = matchesDevMaster(trimmedCode);
        if (!isDevMaster && !passwordEncoder.matches(trimmedCode, verification.getOtpHash())) {
            verification.incrementAttempts();
            verificationRepository.save(verification);
            int remaining = Math.max(0, 5 - verification.getAttempts());
            String hint = remaining > 0 ? remaining + " attempt(s) remaining." : "Please request a new code.";
            throw new BadRequestException("Invalid verification code. " + hint);
        }

        verification.setVerified(true);
        verificationRepository.save(verification);
        return true;
    }

    @Transactional
    public void validateRegistrationOtp(String rawEmail, String otp) {
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new BadRequestException("Email is required");
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        if (isBypassed(email)) return;

        if (otp == null || otp.isBlank()) {
            throw new BadRequestException("Email verification code is required.");
        }

        EmailVerification verification = verificationRepository.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new BadRequestException("Please verify your email before registering."));

        if (verification.isExpired()) {
            throw new BadRequestException("Verification code has expired. Please request a new one.");
        }

        if (verification.getAttempts() >= 5) {
            throw new BadRequestException("Too many failed attempts. Please request a new code.");
        }

        // The code must always match, even if the email was verified earlier: otherwise anyone could
        // register an address whose owner verified it but hasn't finished signing up yet.
        if (!matchesDevMaster(otp.trim()) && !passwordEncoder.matches(otp.trim(), verification.getOtpHash())) {
            verification.incrementAttempts();
            verificationRepository.save(verification);
            throw new BadRequestException("Invalid verification code.");
        }

        // Consume the verification record so it cannot be re-used
        verificationRepository.deleteByEmail(email);
    }

    @Transactional
    public SendOtpResponse sendPasswordResetOtp(String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new BadRequestException("Email is required");
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new NotFoundException("No account found with this email address. Please sign up."));
        if (user.isPlaceholder()) {
            throw new BadRequestException("This account was invited to a group but never activated. Please sign up to create your password.");
        }

        // Cool-down check: must wait at least 60s between codes for the same email
        verificationRepository.findTopByEmailOrderByCreatedAtDesc(email).ifPresent(last -> {
            long elapsedSeconds = Duration.between(last.getCreatedAt(), Instant.now()).getSeconds();
            if (elapsedSeconds < 60) {
                long waitTime = 60 - elapsedSeconds;
                throw new BadRequestException("Please wait " + waitTime + " seconds before requesting another code.");
            }
        });

        // Clean up older pending codes for this email and purge expired records to keep table lean
        verificationRepository.deleteByEmail(email);
        verificationRepository.deleteExpired(Instant.now());

        int codeInt = 100000 + SECURE_RANDOM.nextInt(900000);
        String code = String.valueOf(codeInt);

        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(otpExpiryMinutes));
        String otpHash = passwordEncoder.encode(code);
        EmailVerification verification = new EmailVerification(email, otpHash, expiresAt);
        verificationRepository.save(verification);

        boolean sent = sendBrevoEmail(email, "Your SettleHub Password Reset Code: " + code, buildPasswordResetEmailHtml(code));
        if (!sent) {
            if (brevoApiKey.isBlank()) {
                log.warn("BREVO_API_KEY is not configured. Use the development master code for password reset on '{}' if enabled.", email);
                return new SendOtpResponse(true, false, "Email service not configured. Use development master code.", otpExpiryMinutes * 60);
            }
            throw new BadRequestException("Could not send password reset email. Please try again later.");
        }

        return new SendOtpResponse(true, false, "Password reset code sent to " + email, otpExpiryMinutes * 60);
    }

    @Transactional
    public void validatePasswordResetOtp(String rawEmail, String otp) {
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new BadRequestException("Email is required");
        }
        String email = rawEmail.trim().toLowerCase(Locale.ROOT);

        if (otp == null || otp.isBlank()) {
            throw new BadRequestException("Verification code is required.");
        }

        EmailVerification verification = verificationRepository.findTopByEmailOrderByCreatedAtDesc(email)
                .orElseThrow(() -> new BadRequestException("Please request a reset code before resetting your password."));

        if (verification.isExpired()) {
            throw new BadRequestException("Verification code has expired. Please request a new one.");
        }

        if (verification.getAttempts() >= 5) {
            throw new BadRequestException("Too many failed attempts. Please request a new code.");
        }

        boolean isDevMaster = matchesDevMaster(otp.trim());
        if (!isDevMaster && !passwordEncoder.matches(otp.trim(), verification.getOtpHash())) {
            verification.incrementAttempts();
            verificationRepository.save(verification);
            int remaining = Math.max(0, 5 - verification.getAttempts());
            String hint = remaining > 0 ? remaining + " attempt(s) remaining." : "Please request a new code.";
            throw new BadRequestException("Invalid verification code. " + hint);
        }

        verificationRepository.deleteByEmail(email);
    }

    private boolean sendBrevoEmail(String recipientEmail, String subject, String htmlContent) {
        if (brevoApiKey.isBlank()) {
            return false;
        }

        String senderEmail = !brevoSenderEmail.isBlank() ? brevoSenderEmail
                : (!springMailUsername.isBlank() ? springMailUsername : "noreply@settlehub.com");

        try {
            String jsonBody = "{"
                    + "\"sender\":{\"name\":\"SettleHub\",\"email\":" + jsonString(senderEmail) + "},"
                    + "\"to\":[{\"email\":" + jsonString(recipientEmail) + "}],"
                    + "\"subject\":" + jsonString(subject) + ","
                    + "\"htmlContent\":" + jsonString(htmlContent)
                    + "}";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .timeout(Duration.ofSeconds(10))
                    .header("api-key", brevoApiKey)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                quotaTracker.recordSent();
                log.info("Sent verification code to '{}' via Brevo: HTTP {}", recipientEmail, response.statusCode());
                return true;
            } else {
                log.error("Brevo API error while sending OTP (HTTP {}): {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to dispatch OTP email to '{}': {}", recipientEmail, e.getMessage());
            return false;
        }
    }

    private String buildOtpEmailHtml(String code) {
        return "<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1.0'/></head>"
                + "<body style='margin:0;padding:24px;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f1f5f9;'>"
                + "<div style='max-width:480px;margin:0 auto;background:#0f1726;border:1px solid #1e293b;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);'>"
                + "<div style='display:inline-block;padding:8px 16px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:24px;color:#34d399;font-weight:700;font-size:14px;margin-bottom:20px;letter-spacing:0.5px;'>SettleHub</div>"
                + "<h2 style='margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;'>Verify your email address</h2>"
                + "<p style='margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.5;'>Please use the verification code below to complete your registration. This code will expire in " + otpExpiryMinutes + " minutes.</p>"
                + "<div style='background:#090d16;border:1px solid #334155;border-radius:12px;padding:18px 24px;margin:0 auto 28px;display:inline-block;'>"
                + "<span style='font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#34d399;'>" + code + "</span>"
                + "</div>"
                + "<p style='margin:0;font-size:12px;color:#64748b;line-height:1.5;'>If you did not request this verification code, you can safely ignore this email. No account will be created without this code.</p>"
                + "</div>"
                + "</body></html>";
    }

    private String buildPasswordResetEmailHtml(String code) {
        return "<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width, initial-scale=1.0'/></head>"
                + "<body style='margin:0;padding:24px;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#f1f5f9;'>"
                + "<div style='max-width:480px;margin:0 auto;background:#0f1726;border:1px solid #1e293b;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);'>"
                + "<div style='display:inline-block;padding:8px 16px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:24px;color:#34d399;font-weight:700;font-size:14px;margin-bottom:20px;letter-spacing:0.5px;'>SettleHub</div>"
                + "<h2 style='margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;'>Reset your password</h2>"
                + "<p style='margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.5;'>Use the verification code below to reset your SettleHub account password. This code will expire in " + otpExpiryMinutes + " minutes.</p>"
                + "<div style='background:#090d16;border:1px solid #334155;border-radius:12px;padding:18px 24px;margin:0 auto 28px;display:inline-block;'>"
                + "<span style='font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#34d399;'>" + code + "</span>"
                + "</div>"
                + "<p style='margin:0;font-size:12px;color:#64748b;line-height:1.5;'>If you did not request a password reset, you can safely ignore this email. Your password remains unchanged.</p>"
                + "</div>"
                + "</body></html>";
    }

    private static String jsonString(String str) {
        if (str == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < str.length(); i++) {
            char c = str.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 32) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        sb.append("\"");
        return sb.toString();
    }
}

