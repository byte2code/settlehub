package com.settlehub.repository;

import com.settlehub.model.Settlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface SettlementRepository extends JpaRepository<Settlement, UUID> {

    @Query("""
        SELECT s FROM Settlement s JOIN FETCH s.payer JOIN FETCH s.payee
        WHERE s.group.id = :groupId ORDER BY s.date DESC, s.createdAt DESC
        """)
    List<Settlement> findByGroupId(@Param("groupId") UUID groupId);

    /** Rows of [groupId, payerId, sum(amountCents)]. */
    @Query("SELECT s.group.id, s.payer.id, SUM(s.amountCents) FROM Settlement s WHERE s.group.id IN :groupIds GROUP BY s.group.id, s.payer.id")
    List<Object[]> sumPaidByGroupAndPayer(@Param("groupIds") Collection<UUID> groupIds);

    /** Rows of [groupId, payeeId, sum(amountCents)]. */
    @Query("SELECT s.group.id, s.payee.id, SUM(s.amountCents) FROM Settlement s WHERE s.group.id IN :groupIds GROUP BY s.group.id, s.payee.id")
    List<Object[]> sumReceivedByGroupAndPayee(@Param("groupIds") Collection<UUID> groupIds);

    boolean existsByGroupId(UUID groupId);

    @Modifying
    @Query("DELETE FROM Settlement s WHERE s.group.id = :groupId")
    void deleteByGroupId(@Param("groupId") UUID groupId);
}
