import type { ErrorRequestHandler } from "express";

import { validateErrorEnvelope } from "../../../shared/src/index.js";

import { HttpError, isHttpError } from "../models/errors.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const normalized = isHttpError(error)
    ? error
    : new HttpError(500, "internal_error", error instanceof Error ? error.message : "internal error");

  const payload = {
    error: {
      code: normalized.code,
      message: normalized.message
    }
  };

  if (!validateErrorEnvelope(payload)) {
    response.status(500).json({
      error: {
        code: "internal_error",
        message: "internal error"
      }
    });
    return;
  }

  response.status(normalized.status).json(payload);
};
