import type { ClientFactory } from "@a2a-js/sdk/client";
import { ClientFactory as A2AClientFactory, ClientFactoryOptions, JsonRpcTransport, JsonRpcTransportFactory } from "@a2a-js/sdk/client";

import { createSidecarApp } from "../../sidecar/src/app.js";
import { loadSidecarConfig } from "../../sidecar/src/config/index.js";

import { listenExpress, reservePort } from "./http.js";
import { TEST_BEARER_TOKEN, TEST_SEED_A } from "./fixtures.js";

export async function createStartedSidecar(options?: {
  token?: string;
  publicSkills?: string[];
  seedHex?: string;
  streamingEnabled?: boolean;
  autoRegister?: boolean;
  registryUrl?: string;
}) {
  const port = await reservePort();
  const token = options?.token ?? TEST_BEARER_TOKEN;
  const config = loadSidecarConfig({
    SIDECAR_PORT: String(port),
    SIDECAR_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    SIDECAR_PUBLIC_SKILLS: (options?.publicSkills ?? ["research.summarize"]).join(","),
    SIDECAR_SIGNING_SEED_HEX: options?.seedHex ?? TEST_SEED_A,
    SIDECAR_STREAMING_ENABLED: String(options?.streamingEnabled ?? true),
    SIDECAR_AUTO_REGISTER: String(options?.autoRegister ?? false),
    SIDECAR_REGISTRY_URL: options?.registryUrl,
    A2A_BEARER_TOKEN: token
  });

  const created = await createSidecarApp(config);
  const listener = await listenExpress(created.app, config.port);
  await created.registryLifecycle.start();

  return {
    ...created,
    ...listener,
    config,
    token
  };
}

export function createAuthorizedFetch(token: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("A2A-Version", "0.3");
    return fetch(input, {
      ...init,
      headers
    });
  };
}

export async function createAuthorizedClient(origin: string, token: string) {
  const authFetch = createAuthorizedFetch(token);
  const factory = new A2AClientFactory(
    ClientFactoryOptions.createFrom(ClientFactoryOptions.default, {
      transports: [new JsonRpcTransportFactory({ fetchImpl: authFetch })]
    })
  );

  const client = await factory.createFromUrl(origin);
  const transport = new JsonRpcTransport({
    endpoint: `${origin}/a2a/jsonrpc`,
    fetchImpl: authFetch
  });

  return {
    client,
    transport
  };
}
