/**
 * Typed application errors mapped to HTTP status codes by API helpers.
 */

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource") {
    super(`${entity} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class InsufficientStockError extends AppError {
  constructor(detail: { productId?: string; sku?: string; requested: number; available: number }) {
    super(
      `Insufficient stock${detail.sku ? ` for ${detail.sku}` : ""}: requested ${detail.requested}, available ${detail.available}`,
      422,
      "INSUFFICIENT_STOCK",
      detail,
    );
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`Invalid status transition: ${from} → ${to}`, 422, "INVALID_TRANSITION", { from, to });
  }
}
