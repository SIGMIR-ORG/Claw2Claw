import { createServerApp } from "../../server/src/app.js";
import type { ServerConfig } from "../../server/src/config.js";
import { loadServerConfig } from "../../server/src/config.js";

import { listenExpress } from "./http.js";

export async function createStartedRegistry(options?: {
  fetchImpl?: typeof fetch;
  clock?: () => Date;
  configOverrides?: Partial<ServerConfig>;
}) {
  const config: ServerConfig = {
    ...loadServerConfig({
      SERVER_DB_PATH: ":memory:",
      SERVER_PORT: "0"
    }),
    dbPath: ":memory:",
    ...options?.configOverrides
  };

  const created = createServerApp({
    config,
    fetchImpl: options?.fetchImpl,
    clock: options?.clock
  });

  const listener = await listenExpress(created.app);
  return {
    ...created,
    ...listener
  };
}
