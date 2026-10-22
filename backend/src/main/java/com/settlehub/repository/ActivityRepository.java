package com.settlehub.repository;

import com.settlehub.model.Activity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    @Query("""
        SELECT a FROM Activity a LEFT JOIN FETCH a.actor
        WHERE a.groupId = :groupId AND a.createdAt < :before
        ORDER BY a.createdAt DESC
        """)
    List<Activity> findPage(@Param("groupId") UUID groupId, @Param("before") Instant before, Pageable pageable);

    @Modifying
    @Query("DELETE FROM Activity a WHERE a.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") UUID groupId);
}
