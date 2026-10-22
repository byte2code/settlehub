package com.settlehub.repository;

import com.settlehub.model.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, UUID> {

    @Query("SELECT m FROM GroupMember m JOIN FETCH m.group WHERE m.group.id = :groupId AND m.user.id = :userId")
    Optional<GroupMember> findByGroupIdAndUserId(@Param("groupId") UUID groupId, @Param("userId") UUID userId);

    boolean existsByGroupIdAndUserId(UUID groupId, UUID userId);

    @Query("SELECT m FROM GroupMember m JOIN FETCH m.user WHERE m.group.id = :groupId ORDER BY m.joinedAt")
    List<GroupMember> findAllByGroupId(@Param("groupId") UUID groupId);

    @Query("SELECT m FROM GroupMember m JOIN FETCH m.user WHERE m.group.id IN :groupIds ORDER BY m.joinedAt")
    List<GroupMember> findAllByGroupIdIn(@Param("groupIds") Collection<UUID> groupIds);

    long countByGroupIdAndRole(UUID groupId, String role);

    long countByGroupId(UUID groupId);
}
