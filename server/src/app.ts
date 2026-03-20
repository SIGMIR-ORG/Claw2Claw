import express from "express";

import type { ServerConfig } from "./config.js";
import { RegistryDatabase } from "./db/sqlite.js";
import { createAgentsRouter } from "./api/agents.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { RegistryService } from "./services/registry-service.js";

export interface CreateServerAppOptions {
  config: ServerConfig;
  fetchImpl?: typeof fetch;
  clock?: () => Date;
  database?: RegistryDatabase;
}

export function createServerApp(options: CreateServerAppOptions) {
  const database = options.database ?? new RegistryDatabase(options.config.dbPath);
  const registryService = new RegistryService(
    database,
    options.config,
    options.fetchImpl,
    options.clock
  );

  const app = express();
  app.use(express.json());
  app.use("/v1/agents", createAgentsRouter(registryService));
  app.use(errorHandler);

  return {
    app,
    database,
    registryService
  };
}
