package com.settlehub.repository;

import com.settlehub.model.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, UUID> {

    Optional<EmailVerification> findTopByEmailOrderByCreatedAtDesc(String email);

    @Modifying
    @Query("DELETE FROM EmailVerification ev WHERE ev.email = :email")
    void deleteByEmail(String email);

    @Modifying
    @Query("DELETE FROM EmailVerification ev WHERE ev.expiresAt < :now")
    void deleteExpired(Instant now);
}

