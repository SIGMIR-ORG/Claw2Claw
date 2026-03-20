import express from "express";

const targetA2AUrl = process.env.TCK_TARGET_A2A_URL;
const targetAgentCardUrl = process.env.TCK_TARGET_AGENT_CARD_URL;
const upstreamBearerToken = process.env.TCK_PROXY_BEARER_TOKEN;
const proxyPort = Number.parseInt(process.env.TCK_PROXY_PORT ?? "39101", 10);

if (!targetA2AUrl || !targetAgentCardUrl) {
  throw new Error("TCK_TARGET_A2A_URL and TCK_TARGET_AGENT_CARD_URL are required");
}

const resolvedTargetA2AUrl = targetA2AUrl;
const resolvedTargetAgentCardUrl = targetAgentCardUrl;
const proxyBaseUrl = `http://127.0.0.1:${proxyPort}`;

const supportedOfficialMethods = new Set([
  "message/send",
  "message/stream",
  "tasks/get",
  "tasks/cancel",
  "tasks/resubscribe",
  "agent/getAuthenticatedExtendedCard"
]);

type JsonRpcId = string | number | null;
type JsonObject = Record<string, unknown>;
type ParamsValidationResult =
  | { valid: true; params: JsonObject }
  | { valid: false };

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}

function buildJsonRpcErrorResponse(id: unknown, code: number, message: string): JsonObject {
  return {
    jsonrpc: "2.0",
    id: isJsonRpcId(id) ? id : null,
    error: {
      code,
      message
    }
  };
}

function mapRoleToOfficial(role: string | undefined): string | undefined {
  if (!role) {
    return role;
  }
  if (role === "ROLE_USER") {
    return "user";
  }
  if (role === "ROLE_AGENT") {
    return "agent";
  }
  return role.toLowerCase();
}

function mapRoleToLegacy(role: string | undefined): string | undefined {
  if (!role) {
    return role;
  }
  if (role === "user") {
    return "ROLE_USER";
  }
  if (role === "agent") {
    return "ROLE_AGENT";
  }
  return role;
}

function mapStateToLegacy(state: string | undefined): string | undefined {
  if (!state) {
    return state;
  }
  const mapping: Record<string, string> = {
    submitted: "TASK_STATE_SUBMITTED",
    working: "TASK_STATE_WORKING",
    completed: "TASK_STATE_COMPLETED",
    failed: "TASK_STATE_FAILED",
    canceled: "TASK_STATE_CANCELLED",
    cancelled: "TASK_STATE_CANCELLED",
    "input-required": "TASK_STATE_INPUT_REQUIRED",
    rejected: "TASK_STATE_REJECTED",
    "auth-required": "TASK_STATE_AUTH_REQUIRED"
  };
  return mapping[state] ?? state;
}

function mapPartToOfficial(part: JsonObject) {
  if ("kind" in part) {
    return part;
  }
  if ("text" in part) {
    return { kind: "text", text: String(part.text) };
  }
  if ("url" in part) {
    return {
      kind: "file",
      file: {
        uri: String(part.url),
        name: typeof part.filename === "string" ? part.filename : undefined,
        mimeType: typeof part.mediaType === "string" ? part.mediaType : undefined
      }
    };
  }
  if ("data" in part) {
    return {
      kind: "data",
      data: part.data
    };
  }
  return part;
}

function mapPartToLegacy(part: JsonObject) {
  if (part.kind === "text") {
    return { text: part.text };
  }
  if (part.kind === "file" && isRecord(part.file)) {
    return {
      url: part.file.uri,
      filename: part.file.name,
      mediaType: part.file.mimeType
    };
  }
  if (part.kind === "data") {
    return { data: part.data };
  }
  return part;
}

function mapMessageToOfficial(message: JsonObject) {
  return {
    ...message,
    kind: "message",
    role: mapRoleToOfficial(typeof message.role === "string" ? message.role : undefined),
    parts: Array.isArray(message.parts)
      ? message.parts.map((part) => mapPartToOfficial(part as JsonObject))
      : []
  };
}

function mapMessageToLegacy(message: JsonObject) {
  return {
    ...message,
    role: mapRoleToLegacy(typeof message.role === "string" ? message.role : undefined),
    parts: Array.isArray(message.parts)
      ? message.parts.map((part) => mapPartToLegacy(part as JsonObject))
      : []
  };
}

function mapTaskToLegacy(task: JsonObject) {
  const status = isRecord(task.status) ? task.status : undefined;

  return {
    ...task,
    status: status
      ? {
          ...status,
          state: mapStateToLegacy(typeof status.state === "string" ? status.state : undefined),
          message: isRecord(status.message) ? mapMessageToLegacy(status.message) : status.message
        }
      : task.status,
    history: Array.isArray(task.history)
      ? task.history.map((message) => mapMessageToLegacy(message as JsonObject))
      : task.history
  };
}

function mapJsonRpcMethod(method: string): string {
  const mapping: Record<string, string> = {
    SendMessage: "message/send",
    SendStreamingMessage: "message/stream",
    GetTask: "tasks/get",
    CancelTask: "tasks/cancel",
    SubscribeToTask: "tasks/resubscribe"
  };
  return mapping[method] ?? method;
}

function transformOutgoingResult(method: string, result: unknown): unknown {
  if (!isRecord(result)) {
    return result;
  }

  if (method === "SendMessage") {
    if (result.kind === "task") {
      return { task: mapTaskToLegacy(result) };
    }
    if (result.kind === "message") {
      return { message: mapMessageToLegacy(result) };
    }
  }

  if (
    method === "GetTask" ||
    method === "CancelTask" ||
    method === "SubscribeToTask"
  ) {
    if (result.kind === "task") {
      return mapTaskToLegacy(result);
    }
  }

  return result;
}

function validateMethodParams(method: string, params: unknown): ParamsValidationResult {
  if (params === undefined) {
    if (method === "agent/getAuthenticatedExtendedCard") {
      return { valid: true, params: {} };
    }
    return { valid: false };
  }

  if (!isRecord(params)) {
    return { valid: false };
  }

  if (method === "message/send" || method === "message/stream") {
    if (!isRecord(params.message) || !Array.isArray(params.message.parts)) {
      return { valid: false };
    }
  }

  if (method === "tasks/get" || method === "tasks/cancel" || method === "tasks/resubscribe") {
    if (typeof params.id !== "string" || params.id.length === 0) {
      return { valid: false };
    }
  }

  return { valid: true, params: { ...params } };
}

function transformIncomingRequest(body: unknown): { error?: JsonObject; request?: JsonObject } {
  if (!isRecord(body)) {
    return { error: buildJsonRpcErrorResponse(null, -32600, "Invalid Request") };
  }

  if (body.jsonrpc !== "2.0") {
    return { error: buildJsonRpcErrorResponse(body.id, -32600, "Invalid Request") };
  }

  if (typeof body.method !== "string" || body.method.length === 0) {
    return { error: buildJsonRpcErrorResponse(body.id, -32600, "Invalid Request") };
  }

  if ("id" in body && !isJsonRpcId(body.id)) {
    return { error: buildJsonRpcErrorResponse(null, -32600, "Invalid Request") };
  }

  const mappedMethod = mapJsonRpcMethod(body.method);
  if (!supportedOfficialMethods.has(mappedMethod)) {
    return { error: buildJsonRpcErrorResponse(body.id, -32601, "Method not found") };
  }

  const validatedParams = validateMethodParams(mappedMethod, body.params);
  if (!validatedParams.valid) {
    return {
      error: buildJsonRpcErrorResponse(body.id, -32602, "Invalid params")
    };
  }

  if (mappedMethod === "message/send" || mappedMethod === "message/stream") {
    if (isRecord(validatedParams.params.message)) {
      validatedParams.params.message = mapMessageToOfficial(validatedParams.params.message);
    }
  }

  if (mappedMethod === "message/send") {
    const configuration = isRecord(validatedParams.params.configuration)
      ? { ...validatedParams.params.configuration }
      : {};
    configuration.blocking = false;
    validatedParams.params.configuration = configuration;
  }

  return {
    request: {
      ...body,
      method: mappedMethod,
      params: validatedParams.params
    }
  };
}

function buildForwardHeaders(request: express.Request): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("a2a-version", "0.3");

  const authorization = request.header("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  } else if (upstreamBearerToken) {
    headers.set("authorization", `Bearer ${upstreamBearerToken}`);
  }

  return headers;
}

async function fetchProxyAgentCard(): Promise<JsonObject> {
  const upstream = await fetch(resolvedTargetAgentCardUrl);
  if (!upstream.ok) {
    throw new Error(`upstream agent card fetch failed with ${upstream.status}`);
  }

  const payload = await upstream.json() as JsonObject;
  return {
    ...payload,
    url: proxyBaseUrl,
    endpoint: proxyBaseUrl,
    preferredTransport: "jsonrpc",
    jsonrpc: {
      endpoint: proxyBaseUrl
    }
  };
}

async function handleAgentCardResponse(response: express.Response): Promise<void> {
  try {
    response.json(await fetchProxyAgentCard());
  } catch (error) {
    response.status(503).json({
      error: "upstream_agent_card_unavailable",
      message: error instanceof Error ? error.message : "unknown error"
    });
  }
}

async function proxyJsonRpc(bodyText: string, incomingRequest: express.Request, outgoingResponse: express.Response) {
  let requestBody: unknown;
  try {
    requestBody = JSON.parse(bodyText);
  } catch {
    outgoingResponse.status(200).json(buildJsonRpcErrorResponse(null, -32700, "Parse error"));
    return;
  }

  const transformed = transformIncomingRequest(requestBody);
  if (transformed.error) {
    outgoingResponse.status(200).json(transformed.error);
    return;
  }

  const requestBodyRecord = requestBody as JsonObject;
  const transformedRequest = transformed.request as JsonObject;
  const isStreaming =
    transformedRequest.method === "message/stream" || transformedRequest.method === "tasks/resubscribe";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(resolvedTargetA2AUrl, {
      method: "POST",
      headers: buildForwardHeaders(incomingRequest),
      body: JSON.stringify(transformedRequest)
    });
  } catch (error) {
    outgoingResponse.status(200).json(
      buildJsonRpcErrorResponse(
        requestBodyRecord.id,
        -32603,
        error instanceof Error ? error.message : "Internal error"
      )
    );
    return;
  }

  if (!isStreaming) {
    const contentType = upstreamResponse.headers.get("content-type") ?? "";
    const upstreamPayload = contentType.includes("application/json")
      ? await upstreamResponse.json() as JsonObject
      : buildJsonRpcErrorResponse(requestBodyRecord.id, -32603, await upstreamResponse.text());

    if ("result" in upstreamPayload) {
      upstreamPayload.result = transformOutgoingResult(String(requestBodyRecord.method), upstreamPayload.result);
    }

    if (!upstreamResponse.ok && !("error" in upstreamPayload)) {
      outgoingResponse.status(200).json(
        buildJsonRpcErrorResponse(requestBodyRecord.id, -32603, `HTTP ${upstreamResponse.status}`)
      );
      return;
    }

    outgoingResponse.status(200).json(upstreamPayload);
    return;
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const payload = await upstreamResponse.text();
    outgoingResponse.status(200).json(
      buildJsonRpcErrorResponse(requestBodyRecord.id, -32603, payload || `HTTP ${upstreamResponse.status}`)
    );
    return;
  }

  outgoingResponse.status(200);
  outgoingResponse.setHeader("content-type", "text/event-stream");
  outgoingResponse.setHeader("cache-control", "no-cache");
  outgoingResponse.setHeader("connection", "keep-alive");

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLine = event
        .split("\n")
        .find((line) => line.startsWith("data:"));
      if (!dataLine) {
        continue;
      }

      const payload = JSON.parse(dataLine.slice(5).trim()) as JsonObject;
      const transformedPayload = {
        ...payload,
        result: transformOutgoingResult(String(requestBodyRecord.method), payload.result)
      };
      outgoingResponse.write(`data: ${JSON.stringify(transformedPayload)}\n\n`);
    }
  }

  outgoingResponse.end();
}

const app = express();
const rawJsonBody = express.text({
  type: ["application/json", "application/*+json", "text/plain", "*/*"],
  limit: "1mb"
});

app.get("/", async (_request, response) => {
  await handleAgentCardResponse(response);
});

app.get("/.well-known/agent-card.json", async (_request, response) => {
  await handleAgentCardResponse(response);
});

app.get("/.well-known/agent.json", async (_request, response) => {
  await handleAgentCardResponse(response);
});

app.post("/", rawJsonBody, async (request, response) => {
  await proxyJsonRpc(request.body ?? "", request, response);
});

app.post("/a2a/jsonrpc", rawJsonBody, async (request, response) => {
  await proxyJsonRpc(request.body ?? "", request, response);
});

app.listen(proxyPort, "127.0.0.1", () => {
  console.log(`tck proxy listening on http://127.0.0.1:${proxyPort}`);
});
