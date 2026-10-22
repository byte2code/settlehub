package com.settlehub.exception;

/** 403 Forbidden — the caller can see the resource but lacks the role for this action. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
