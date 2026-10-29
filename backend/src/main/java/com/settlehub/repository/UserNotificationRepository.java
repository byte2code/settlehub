package com.settlehub.repository;

import com.settlehub.model.UserNotification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserNotificationRepository extends JpaRepository<UserNotification, UUID> {

    @Query("""
        SELECT n FROM UserNotification n LEFT JOIN FETCH n.actor
        WHERE n.userId = :userId
        ORDER BY n.createdAt DESC
        """)
    List<UserNotification> findByUserId(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT COUNT(n) FROM UserNotification n WHERE n.userId = :userId AND n.read = false")
    long countUnreadByUserId(@Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true WHERE n.id = :id AND n.userId = :userId")
    int markAsRead(@Param("id") UUID id, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true WHERE n.userId = :userId AND n.read = false")
    int markAllReadByUserId(@Param("userId") UUID userId);
}

