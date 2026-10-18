package com.settlehub.config;

import com.settlehub.model.User;
import com.settlehub.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    public CommandLineRunner initDefaultUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.findByEmail("alice@settlehub.com").isEmpty()) {
                User alice = new User(
                    "alice@settlehub.com",
                    passwordEncoder.encode("password123"),
                    "Alice",
                    "Demo",
                    "INR"
                );
                userRepository.save(alice);
            }

            if (userRepository.findByEmail("bob@settlehub.com").isEmpty()) {
                User bob = new User(
                    "bob@settlehub.com",
                    passwordEncoder.encode("password123"),
                    "Bob",
                    "Demo",
                    "INR"
                );
                userRepository.save(bob);
            }
        };
    }
}
