package com.settlehub.repository;

import com.settlehub.model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
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

    long countByArchivedFalse();

    /** Rows of [id, name, currencyCode, archived, createdAt, memberCount]; pattern is pre-lowercased. */
    @Query("""
        SELECT g.id, g.name, g.currencyCode, g.archived, g.createdAt,
               (SELECT COUNT(m) FROM GroupMember m WHERE m.group.id = g.id)
        FROM Group g WHERE LOWER(g.name) LIKE :pattern ESCAPE '!' ORDER BY g.createdAt DESC
        """)
    List<Object[]> searchForAdmin(@Param("pattern") String pattern, Pageable pageable);
}
