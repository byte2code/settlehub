package com.settlehub.repository;

import com.settlehub.model.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    List<PushSubscription> findByUserId(UUID userId);

    Optional<PushSubscription> findByDeviceToken(String deviceToken);

    long deleteByDeviceTokenAndUserId(String deviceToken, UUID userId);
}
