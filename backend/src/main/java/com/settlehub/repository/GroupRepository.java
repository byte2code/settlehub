package com.settlehub.repository;

import com.settlehub.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    @Query("SELECT g FROM Group g JOIN g.members m WHERE m.user.id = :userId ORDER BY g.updatedAt DESC")
    List<Group> findAllForUser(@Param("userId") UUID userId);

    Optional<Group> findByInviteCodeIgnoreCase(String inviteCode);

    boolean existsByInviteCode(String inviteCode);
}
