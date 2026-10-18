package com.settlehub.repository;

import com.settlehub.model.Group;
import com.settlehub.model.Settlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SettlementRepository extends JpaRepository<Settlement, UUID> {
    List<Settlement> findAllByGroupOrderByDateDesc(Group group);
}
