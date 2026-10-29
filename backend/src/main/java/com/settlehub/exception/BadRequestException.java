package com.settlehub.exception;

/** 400 Bad Request — validation or business logic precondition failed. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}

