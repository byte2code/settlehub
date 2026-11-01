package com.settlehub.repository;

import com.settlehub.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    long countByPlaceholderFalse();

    /** Rows of [id, email, firstName, lastName, createdAt, active, admin, groupCount]; pattern is pre-lowercased. */
    @Query("""
        SELECT u.id, u.email, u.firstName, u.lastName, u.createdAt, u.active, u.admin,
               (SELECT COUNT(m) FROM GroupMember m WHERE m.user.id = u.id)
        FROM User u
        WHERE u.placeholder = false
          AND (LOWER(u.email) LIKE :pattern ESCAPE '!' OR LOWER(u.firstName) LIKE :pattern ESCAPE '!' OR LOWER(COALESCE(u.lastName, '')) LIKE :pattern ESCAPE '!')
        ORDER BY u.createdAt DESC
        """)
    List<Object[]> searchForAdmin(@Param("pattern") String pattern, Pageable pageable);
}
