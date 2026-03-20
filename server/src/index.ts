import { createServerApp } from "./app.js";
import { loadServerConfig } from "./config.js";

const config = loadServerConfig();
const { app } = createServerApp({ config });

app.listen(config.port, config.host, () => {
  console.log(`claw2claw-server listening on http://${config.host}:${config.port}`);
});
