package com.settlehub.service;

import com.settlehub.repository.EmailVerificationRepository;
import com.settlehub.repository.ExpenseReceiptRepository;
import com.settlehub.repository.UserNotificationRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Housekeeping that keeps the free database small. Safe to run any number of times. */
@Service
public class MaintenanceService {

    private final ExpenseReceiptRepository receiptRepository;
    private final UserNotificationRepository notificationRepository;
    private final EmailVerificationRepository verificationRepository;
    private final int receiptRetentionDays;

    public MaintenanceService(ExpenseReceiptRepository receiptRepository, UserNotificationRepository notificationRepository,
                              EmailVerificationRepository verificationRepository,
                              @Value("${app.receipts.retention-days:365}") int receiptRetentionDays) {
        this.receiptRepository = receiptRepository;
        this.notificationRepository = notificationRepository;
        this.verificationRepository = verificationRepository;
        this.receiptRetentionDays = receiptRetentionDays;
    }

    @Transactional
    public Map<String, Object> purge() {
        Instant now = Instant.now();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("receiptsRemoved", receiptRetentionDays > 0 ? purgeReceiptsOlderThan(now.minus(Duration.ofDays(receiptRetentionDays))) : 0);
        result.put("notificationsRemoved", notificationRepository.deleteOlderThan(now.minus(Duration.ofDays(90))));
        verificationRepository.deleteExpired(now);
        result.put("ranAt", now);
        return result;
    }

    /** Expenses keep their record; only the photo goes ("receipt expired" in the app). */
    @Transactional
    public int purgeReceiptsOlderThan(Instant cutoff) {
        receiptRepository.clearReceiptFlagsOlderThan(cutoff);
        return receiptRepository.deleteOlderThan(cutoff);
    }
}
