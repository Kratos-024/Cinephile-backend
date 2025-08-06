// utils/errors.ts

type ErrorType =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly type: ErrorType;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    statusCode: number,
    message: string,
    type: ErrorType = "INTERNAL_ERROR",
    details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.type = type;
    this.details = details;
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Resource not found", details?: any) {
    super(404, message, "NOT_FOUND", details);
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Validation failed", details?: any) {
    super(400, message, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", details?: any) {
    super(401, message, "UNAUTHORIZED", details);
  }
}
