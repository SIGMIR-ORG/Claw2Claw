import { timingSafeEqual } from "node:crypto";

import type { Request, RequestHandler } from "express";

import { A2AError } from "@a2a-js/sdk/server";

import { constantTimeBearerHash } from "../../../shared/src/index.js";

export interface AuthenticatedRequest extends Request {
  claw2clawUser?: {
    userName: string;
    isAuthenticated: boolean;
  };
}

function unauthorizedResponse(request: Request, response: Parameters<RequestHandler>[1], message: string) {
  response.status(401).json({
    jsonrpc: "2.0",
    id: null,
    error: A2AError.invalidRequest(message).toJSONRPCError()
  });
}

function bufferEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createBearerAuthMiddleware(expectedTokenHashes: string[]): RequestHandler {
  return (request, response, next) => {
    const authorization = request.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      unauthorizedResponse(request, response, "missing bearer token");
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();
    const tokenHash = constantTimeBearerHash(token);
    const valid = expectedTokenHashes.some((expectedHash) => bufferEquals(expectedHash, tokenHash));

    if (!valid) {
      unauthorizedResponse(request, response, "invalid bearer token");
      return;
    }

    (request as AuthenticatedRequest).claw2clawUser = {
      userName: `bearer:${tokenHash.slice(0, 12)}`,
      isAuthenticated: true
    };
    next();
  };
}

export function createA2AVersionMiddleware(expectedVersion: string): RequestHandler {
  return (request, response, next) => {
    const version = request.header("a2a-version");
    if (version && version !== expectedVersion && version !== `${expectedVersion}.0`) {
      response.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: A2AError.invalidRequest(`unsupported A2A version: ${version}`).toJSONRPCError()
      });
      return;
    }

    next();
  };
}

export async function buildAuthenticatedUser(request: AuthenticatedRequest) {
  return (
    request.claw2clawUser ?? {
      userName: "anonymous",
      isAuthenticated: false
    }
  );
}
