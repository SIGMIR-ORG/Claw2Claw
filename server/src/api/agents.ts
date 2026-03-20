import { Router } from "express";

import {
  normalizeRequestTarget,
  validateGetAgentResponse,
  validateHeartbeatRequest,
  validateHeartbeatResponse,
  validateRegisterAgentRequest,
  validateRegisterAgentResponse,
  validateSearchResponse,
  validateUnregisterRequest,
  validateUnregisterResponse,
  validationErrorMessage
} from "../../../shared/src/index.js";
import type { RegistryStatus } from "../../../shared/src/index.js";

import { HttpError } from "../models/errors.js";
import type { SearchFilters } from "../models/registry.js";
import { RegistryService } from "../services/registry-service.js";

function requestTargetFromExpress(originalUrl: string): string {
  const parsed = new URL(originalUrl, "http://registry.local");
  return normalizeRequestTarget(parsed.pathname, parsed.search);
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new HttpError(400, "invalid_query", "boolean query parameters must be true or false");
}

function parseStatusQuery(value: unknown): RegistryStatus | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "online" || value === "stale" || value === "offline") {
    return value;
  }
  throw new HttpError(400, "invalid_query", "status must be online, stale, or offline");
}

function parseLimit(value: unknown): number {
  if (value === undefined) {
    return 20;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new HttpError(400, "invalid_query", "limit must be between 1 and 100");
  }
  return parsed;
}

export function createAgentsRouter(registryService: RegistryService): Router {
  const router = Router();

  router.post("/register", async (request, response, next) => {
    try {
      if (!validateRegisterAgentRequest(request.body)) {
        throw new HttpError(
          400,
          "invalid_request",
          validationErrorMessage(validateRegisterAgentRequest.errors)
        );
      }

      const payload = await registryService.registerAgent(
        request.body,
        requestTargetFromExpress(request.originalUrl)
      );

      if (!validateRegisterAgentResponse(payload)) {
        throw new HttpError(500, "internal_error", "register response failed schema validation");
      }

      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post("/heartbeat", async (request, response, next) => {
    try {
      if (!validateHeartbeatRequest(request.body)) {
        throw new HttpError(
          400,
          "invalid_request",
          validationErrorMessage(validateHeartbeatRequest.errors)
        );
      }

      const payload = await registryService.heartbeatAgent(
        request.body,
        requestTargetFromExpress(request.originalUrl)
      );

      if (!validateHeartbeatResponse(payload)) {
        throw new HttpError(500, "internal_error", "heartbeat response failed schema validation");
      }

      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/search", (request, response, next) => {
    try {
      const filters: SearchFilters = {
        skill: typeof request.query.skill === "string" ? request.query.skill : undefined,
        verified: parseBooleanQuery(request.query.verified),
        region: typeof request.query.region === "string" ? request.query.region : undefined,
        status: parseStatusQuery(request.query.status),
        acceptsDelegation: parseBooleanQuery(request.query.acceptsDelegation),
        limit: parseLimit(request.query.limit),
        cursor: typeof request.query.cursor === "string" ? request.query.cursor : undefined
      };

      const payload = registryService.searchAgents(filters);
      if (!validateSearchResponse(payload)) {
        throw new HttpError(500, "internal_error", "search response failed schema validation");
      }

      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", (request, response, next) => {
    try {
      const payload = registryService.getAgent(request.params.id);
      if (!validateGetAgentResponse(payload)) {
        throw new HttpError(500, "internal_error", "get-agent response failed schema validation");
      }
      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.post("/unregister", async (request, response, next) => {
    try {
      if (!validateUnregisterRequest(request.body)) {
        throw new HttpError(
          400,
          "invalid_request",
          validationErrorMessage(validateUnregisterRequest.errors)
        );
      }

      const payload = await registryService.unregisterAgent(
        request.body,
        requestTargetFromExpress(request.originalUrl)
      );

      if (!validateUnregisterResponse(payload)) {
        throw new HttpError(500, "internal_error", "unregister response failed schema validation");
      }

      response.json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
