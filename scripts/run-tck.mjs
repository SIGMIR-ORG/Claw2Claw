import { spawn, spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cacheDir = path.join(rootDir, ".tck-cache");
const repoDir = path.join(cacheDir, "a2a-tck");
const tckRef = "b03fefcae9767dad0e978e11573192f74252dfe3";
const sidecarPort = 39100;
const proxyPort = 39101;
const bearerToken = "tck-bearer-token";
const loopbackNoProxy = "127.0.0.1,localhost";

const localNetworkEnv = {
  NO_PROXY: loopbackNoProxy,
  no_proxy: loopbackNoProxy,
  HTTP_PROXY: "",
  HTTPS_PROXY: "",
  ALL_PROXY: "",
  http_proxy: "",
  https_proxy: "",
  all_proxy: ""
};

async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    env: { ...process.env, ...options.env },
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with code ${result.status}`);
  }
}

async function waitForUrl(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until next attempt
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function main() {
  process.env.NO_PROXY = loopbackNoProxy;
  process.env.no_proxy = loopbackNoProxy;

  const pythonCommand = spawnSync("python3", ["--version"], { stdio: "ignore" }).status === 0
    ? "python3"
    : "python";

  await ensureDir(cacheDir);

  if (spawnSync("git", ["-C", repoDir, "rev-parse", "--is-inside-work-tree"], { stdio: "ignore" }).status !== 0) {
    run("git", ["clone", "https://github.com/a2aproject/a2a-tck.git", repoDir], { cwd: cacheDir });
  }
  run("git", ["fetch", "--all", "--tags"], { cwd: repoDir });
  run("git", ["checkout", tckRef], { cwd: repoDir });

  const venvDir = path.join(repoDir, ".venv");
  if (spawnSync(pythonCommand, ["-c", "import venv"], { stdio: "ignore" }).status !== 0) {
    throw new Error("python venv module is unavailable");
  }
  if (spawnSync("test", ["-d", venvDir], { stdio: "ignore" }).status !== 0) {
    run(pythonCommand, ["-m", "venv", ".venv"], { cwd: repoDir });
  }

  const pipPath = path.join(venvDir, "bin", "pip");
  const pythonPath = path.join(venvDir, "bin", "python");
  run(pipPath, ["install", "-e", "."], { cwd: repoDir });

  const sidecarEnv = {
    SIDECAR_HOST: "127.0.0.1",
    SIDECAR_PORT: String(sidecarPort),
    SIDECAR_PUBLIC_ORIGIN: `http://127.0.0.1:${sidecarPort}`,
    SIDECAR_PUBLIC_SKILLS: "research.summarize",
    SIDECAR_AUTO_REGISTER: "false",
    SIDECAR_STREAMING_ENABLED: "true",
    SIDECAR_SIGNING_SEED_HEX: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    A2A_BEARER_TOKEN: bearerToken,
    TCK_STREAMING_TIMEOUT: "2"
  };

  const sidecarProcess = spawn("node", ["--import", "tsx", "sidecar/src/index.ts"], {
    cwd: rootDir,
    env: { ...process.env, ...localNetworkEnv, ...sidecarEnv },
    stdio: "inherit"
  });

  await waitForUrl(`http://127.0.0.1:${sidecarPort}/.well-known/agent-card.json`);

  const proxyProcess = spawn("node", ["--import", "tsx", "tests/tck/proxy.ts"], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...localNetworkEnv,
      TCK_PROXY_PORT: String(proxyPort),
      TCK_PROXY_BEARER_TOKEN: bearerToken,
      TCK_TARGET_A2A_URL: `http://127.0.0.1:${sidecarPort}/a2a/jsonrpc`,
      TCK_TARGET_AGENT_CARD_URL: `http://127.0.0.1:${sidecarPort}/.well-known/agent-card.json`
    },
    stdio: "inherit"
  });

  let exitCode = 0;
  try {
    await waitForUrl(`http://127.0.0.1:${proxyPort}/.well-known/agent-card.json`);
    run(
      pythonPath,
      [
        "run_tck.py",
        "--sut-url",
        `http://127.0.0.1:${proxyPort}`,
        "--category",
        "mandatory",
        "--transports",
        "jsonrpc"
      ],
      {
        cwd: repoDir,
        env: {
          ...localNetworkEnv,
          A2A_REQUIRED_TRANSPORTS: "jsonrpc",
          A2A_TRANSPORT_STRATEGY: "prefer_jsonrpc",
          A2A_AUTH_TYPE: "bearer",
          A2A_AUTH_TOKEN: bearerToken,
          TCK_STREAMING_TIMEOUT: "2"
        }
      }
    );
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    sidecarProcess.kill("SIGTERM");
    proxyProcess.kill("SIGTERM");
  }

  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
