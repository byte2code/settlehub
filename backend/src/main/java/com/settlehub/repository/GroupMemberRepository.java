package com.settlehub.repository;

import com.settlehub.model.Group;
import com.settlehub.model.GroupMember;
import com.settlehub.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, UUID> {
    Optional<GroupMember> findByGroupAndUser(Group group, User user);
    List<GroupMember> findAllByGroup(Group group);
    boolean existsByGroupAndUser(Group group, User user);
}
