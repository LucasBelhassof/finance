import { ZodError } from "zod";

export class HttpError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(code = "unauthorized", message = "Authentication is required.") {
    super(401, code, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(code = "forbidden", message = "You do not have access to this resource.") {
    super(403, code, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(code = "bad_request", message = "The request is invalid.", details?: unknown) {
    super(400, code, message, details);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof HttpError ||
    (error instanceof Error &&
      typeof (error as { status?: unknown }).status === "number" &&
      typeof (error as { code?: unknown }).code === "string")
  );
}

export function toHttpError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new BadRequestError("validation_error", "Request validation failed.", error.flatten());
  }

  const message = error instanceof Error ? error.message : "The backend failed while processing the request.";
  const normalized = message.toLowerCase();

  if (normalized.includes("not found")) {
    return new HttpError(404, "not_found", message);
  }

  if (
    normalized.includes("required") ||
    normalized.includes("invalid") ||
    normalized.includes("expirou") ||
    normalized.includes("no maximo") ||
    normalized.includes("lista de linhas") ||
    normalized.includes("nao pertencem") ||
    normalized.includes("nao foi possivel identificar")
  ) {
    return new BadRequestError("bad_request", message);
  }

  return new HttpError(500, "internal_server_error", message);
}
