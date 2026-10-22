package com.settlehub.config;

import com.settlehub.dto.CreateExpenseRequest;
import com.settlehub.dto.CreateGroupRequest;
import com.settlehub.dto.GroupDto;
import com.settlehub.model.User;
import com.settlehub.repository.UserRepository;
import com.settlehub.service.ExpenseService;
import com.settlehub.service.GroupService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Seeds demo accounts (alice@ / bob@settlehub.com, password "password123") and a sample trip.
 * Only runs when app.seed-demo-data=true, or =auto (default) on the in-memory H2 database,
 * so production databases never receive known credentials.
 */
@Configuration
public class DataInitializer {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    static boolean shouldSeed(String setting, String datasourceUrl) {
        return switch (setting == null ? "auto" : setting.trim().toLowerCase()) {
            case "true" -> true;
            case "false" -> false;
            default -> datasourceUrl != null && datasourceUrl.startsWith("jdbc:h2:mem:");
        };
    }

    @Bean
    public CommandLineRunner seedDemoData(UserRepository userRepository,
                                          PasswordEncoder passwordEncoder,
                                          GroupService groupService,
                                          ExpenseService expenseService,
                                          @Value("${app.seed-demo-data:auto}") String setting,
                                          @Value("${spring.datasource.url:}") String datasourceUrl) {
        return args -> {
            if (!shouldSeed(setting, datasourceUrl) || userRepository.existsByEmail("alice@settlehub.com")) {
                return;
            }
            User alice = userRepository.save(new User("alice@settlehub.com", passwordEncoder.encode("password123"), "Alice", "Demo", "INR"));
            User bob = userRepository.save(new User("bob@settlehub.com", passwordEncoder.encode("password123"), "Bob", "Demo", "INR"));
            alice.setUpiId("alice@okdemo");
            userRepository.save(alice);

            GroupDto trip = groupService.createGroup(alice.getId(),
                new CreateGroupRequest("Goa Trip (demo)", "trip", true, "INR", 3_000_000L, List.of(bob.getEmail())));
            List<CreateExpenseRequest.SplitRequest> both = List.of(
                new CreateExpenseRequest.SplitRequest(alice.getId(), null, null),
                new CreateExpenseRequest.SplitRequest(bob.getId(), null, null));
            expenseService.createExpense(trip.id(), alice.getId(), new CreateExpenseRequest(
                "Beach shack dinner", 240_000L, "INR", Instant.now().minus(1, ChronoUnit.DAYS), "FOOD", null, "EQUAL",
                null, both, null, null, null));
            expenseService.createExpense(trip.id(), bob.getId(), new CreateExpenseRequest(
                "Scooter rental", 120_000L, "INR", Instant.now(), "TRANSPORT", null, "EQUAL",
                null, both, "2 scooters x 2 days", null, null));
            log.info("Seeded demo data: alice@settlehub.com / bob@settlehub.com (password: password123)");
        };
    }
}
