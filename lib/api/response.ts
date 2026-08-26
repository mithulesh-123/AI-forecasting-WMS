import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { message: string; code: string; details?: unknown };
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, init);
}

export function created<T>(data: T): NextResponse<ApiSuccess<T>> {
  return ok(data, { status: 201 });
}

export function fail(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { success: false, error: { message, code, details } },
    { status },
  );
}

/** Maps any thrown error to a consistent API failure response. */
export function handleApiError(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, "VALIDATION_ERROR", error.flatten());
  }
  if (error instanceof AppError) {
    return fail(error.message, error.status, error.code, error.details);
  }
  console.error("[api] Unhandled error:", error);
  return fail("An unexpected error occurred", 500, "INTERNAL_ERROR");
}
