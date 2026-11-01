package com.settlehub.service;

import java.util.Optional;

/** Verifies a Google ID token. Swappable so tests don't call Google. */
public interface GoogleIdentityVerifier {

    record GoogleIdentity(String email, String givenName, String familyName) {}

    boolean configured();

    /** Empty when the token is invalid, expired, for another app, or the email isn't verified by Google. */
    Optional<GoogleIdentity> verify(String idToken);
}
