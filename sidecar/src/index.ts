import { createSidecarApp } from "./app.js";
import { loadSidecarConfig } from "./config/index.js";

const config = loadSidecarConfig();
const { app, registryLifecycle } = await createSidecarApp(config);

const server = app.listen(config.port, config.host, async () => {
  console.log(`openclaw-a2a-sidecar listening on http://${config.host}:${config.port}`);
  await registryLifecycle.start();
});

async function shutdown(): Promise<void> {
  await registryLifecycle.stop();
  server.close();
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
