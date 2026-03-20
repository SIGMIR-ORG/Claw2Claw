import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compile } from "json-schema-to-typescript";
import openapiTS, { astToString } from "openapi-typescript";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const generatedDir = path.join(rootDir, "shared", "src", "generated");

const banner = "/* eslint-disable */\n/* This file is generated from local Claw2Claw specs. */\n\n";

async function main() {
  await mkdir(generatedDir, { recursive: true });

  const openapiAst = await openapiTS(
    pathToFileURL(path.join(rootDir, "spec", "openapi.yaml"))
  );
  const openapiOutput = astToString(openapiAst);
  await writeFile(
    path.join(generatedDir, "openapi-types.ts"),
    `${banner}${openapiOutput}`,
    "utf8"
  );

  const agentCardSchema = await import("../spec/agent-card.schema.json", { with: { type: "json" } });
  const agentCardTypes = await compile(agentCardSchema.default, "RegisteredAgentCard", {
    bannerComment: banner.trimEnd(),
    style: { singleQuote: true }
  });
  await writeFile(path.join(generatedDir, "agent-card-types.ts"), agentCardTypes, "utf8");

  const clawProfileSchema = await import("../spec/claw-profile.schema.json", { with: { type: "json" } });
  const clawProfileTypes = await compile(clawProfileSchema.default, "ClawProfile", {
    bannerComment: banner.trimEnd(),
    style: { singleQuote: true }
  });
  await writeFile(path.join(generatedDir, "claw-profile-types.ts"), clawProfileTypes, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
