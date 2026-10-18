package com.settlehub.repository;

import com.settlehub.model.Group;
import com.settlehub.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    @Query("SELECT g FROM Group g JOIN g.members m WHERE m.user = :user ORDER BY g.updatedAt DESC")
    List<Group> findAllForUser(@Param("user") User user);

    java.util.Optional<Group> findByInviteCodeIgnoreCase(String inviteCode);
}
