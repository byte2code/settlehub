package com.settlehub.exception;

/** 404 Not Found — also used for resources the caller may not see, so existence is not leaked. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
