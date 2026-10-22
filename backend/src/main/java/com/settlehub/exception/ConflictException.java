package com.settlehub.exception;

/** 409 Conflict — the request clashes with current state (duplicate email, non-zero balance, ...). */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
