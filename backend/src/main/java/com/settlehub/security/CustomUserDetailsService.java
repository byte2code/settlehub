package com.settlehub.security;

import com.settlehub.model.User;
import com.settlehub.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserPrincipal loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email.trim().toLowerCase())
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return UserPrincipal.create(user);
    }

    @Transactional(readOnly = true)
    public UserPrincipal loadUserById(UUID id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return UserPrincipal.create(user);
    }
}
