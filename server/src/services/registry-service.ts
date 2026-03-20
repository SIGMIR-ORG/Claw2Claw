import { randomUUID } from "node:crypto";

import {
  assertValidClawProfile,
  computeRegistryStatus,
  hashCanonicalJsonPrefixed,
  REGISTRY_SIGNATURE_ALGORITHM,
  resolvePublicKey,
  verifyRegistrySignature,
  withoutSignature
} from "../../../shared/src/index.js";

import type { TrustTier } from "../../../shared/src/index.js";
import type { ServerConfig } from "../config.js";
import type {
  ClawProfile,
  GetAgentResponse,
  HeartbeatRequest,
  HeartbeatResponse,
  RegisterAgentRequest,
  RegisterAgentResponse,
  SearchFilters,
  SearchResponse,
  StoredRegistryRecord,
  UnregisterRequest,
  UnregisterResponse
} from "../models/registry.js";

import { HttpError } from "../models/errors.js";
import { RegistryDatabase } from "../db/sqlite.js";
import { fetchAndValidateAgentCard } from "./agent-card-service.js";

function isVerifiedTrustTier(trustTier: TrustTier): boolean {
  return trustTier === "domain_verified" || trustTier === "manually_verified";
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8")
    .toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: number;
    };
    const offset = decoded.offset;
    if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
      throw new Error("cursor offset must be a non-negative integer");
    }
    return offset;
  } catch (error) {
    throw new HttpError(400, "invalid_cursor", "cursor is invalid");
  }
}

export class RegistryService {
  constructor(
    private readonly database: RegistryDatabase,
    private readonly config: ServerConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async registerAgent(
    request: RegisterAgentRequest,
    requestTarget: string
  ): Promise<RegisterAgentResponse> {
    const submittedAgentCard = request.agentCard;
    const submittedKeys = submittedAgentCard.claw2clawRegistry.keys;

    await this.verifyMutatingRequest({
      method: "POST",
      path: requestTarget,
      body: request,
      signature: request.signature,
      keys: submittedKeys
    });

    const agentCardUrl = new URL(request.agentCardUrl);
    if (request.clawProfile.visibility === "public" && this.config.requireHttpsForPublic && agentCardUrl.protocol !== "https:") {
      throw new HttpError(400, "public_https_required", "public registrations require HTTPS Agent Card URLs");
    }
    if (agentCardUrl.protocol !== "https:" && !this.config.allowSelfAttested) {
      throw new HttpError(400, "self_attested_disabled", "self-attested registrations are disabled");
    }

    const { agentCard: liveAgentCard, agentCardHash } = await fetchAndValidateAgentCard(
      this.fetchImpl,
      request.agentCardUrl
    );

    const submittedHash = hashCanonicalJsonPrefixed(submittedAgentCard);
    if (submittedHash !== agentCardHash) {
      throw new HttpError(400, "card_mismatch", "submitted Agent Card does not match the live Agent Card");
    }

    const liveSigningKey = resolvePublicKey(request.signature.keyId, liveAgentCard.claw2clawRegistry.keys);
    if (!liveSigningKey) {
      throw new HttpError(401, "invalid_signature", "signature keyId is not present in the live Agent Card");
    }

    const bodyWithoutSignature = withoutSignature(request);
    const verified = verifyRegistrySignature({
      method: "POST",
      path: requestTarget,
      bodyWithoutSignature,
      signature: request.signature,
      publicKey: liveSigningKey.publicKey
    });

    if (!verified) {
      throw new HttpError(401, "invalid_signature", "signature verification failed");
    }

    const now = this.clock();
    const nowIso = now.toISOString();
    const existingRecord = this.database.findRecordByAgentCardUrl(request.agentCardUrl);

    const trustTier = this.resolveTrustTier(
      request.agentCardUrl,
      existingRecord,
      request.clawProfile
    );

    const authoritativeProfile = assertValidClawProfile({
      ...request.clawProfile,
      trustTier
    }) as ClawProfile;

    const matchingRecord = existingRecord && existingRecord.signingKeys.some((key) =>
      submittedKeys.some(
        (submittedKey) =>
          submittedKey.id === key.id && submittedKey.publicKey === key.publicKey
      )
    )
      ? existingRecord
      : undefined;

    const record: StoredRegistryRecord = {
      id: matchingRecord?.id ?? randomUUID(),
      agentCardUrl: request.agentCardUrl,
      agentCardHash,
      agentCardSnapshot: liveAgentCard,
      clawProfile: authoritativeProfile,
      trustTier,
      signingKeys: liveAgentCard.claw2clawRegistry.keys,
      lastSeenAt: nowIso,
      lastValidatedAt: nowIso,
      heartbeatIntervalSeconds: this.config.heartbeatIntervalSeconds,
      heartbeatTtlSeconds: this.config.heartbeatTtlSeconds,
      createdAt: matchingRecord?.createdAt ?? nowIso,
      updatedAt: nowIso,
      tombstonedAt: null
    };

    this.database.upsertRecord(record);

    return {
      id: record.id,
      trustTier: record.trustTier,
      heartbeatIntervalSeconds: record.heartbeatIntervalSeconds,
      heartbeatTtlSeconds: record.heartbeatTtlSeconds
    };
  }

  async heartbeatAgent(
    request: HeartbeatRequest,
    requestTarget: string
  ): Promise<HeartbeatResponse> {
    const record = this.database.getRecordById(request.id);
    if (!record) {
      throw new HttpError(404, "not_found", `agent ${request.id} was not found`);
    }

    await this.verifyMutatingRequest({
      method: "POST",
      path: requestTarget,
      body: request,
      signature: request.signature,
      keys: record.signingKeys
    });

    const now = this.clock();
    const nowIso = now.toISOString();
    const updatedRecord: StoredRegistryRecord = {
      ...record,
      lastSeenAt: nowIso,
      updatedAt: nowIso
    };

    this.database.upsertRecord(updatedRecord);

    return {
      status: "online",
      recordedAt: nowIso,
      nextHeartbeatDeadlineAt: new Date(
        now.getTime() + updatedRecord.heartbeatTtlSeconds * 1000
      ).toISOString()
    };
  }

  searchAgents(filters: SearchFilters): SearchResponse {
    const now = this.clock();
    const offset = decodeCursor(filters.cursor);
    const results = this.database
      .listActiveRecords()
      .map((record) => this.toSearchResult(record, now))
      .filter((record) => record.clawProfile.visibility === "public")
      .filter((record) => (filters.status ? record.status === filters.status : record.status !== "offline"))
      .filter((record) => (filters.skill ? record.agentCardSnapshot.skills.some((skill) => skill.id === filters.skill) : true))
      .filter((record) => (filters.verified === undefined ? true : record.verified === filters.verified))
      .filter((record) => (filters.region ? record.clawProfile.region === filters.region : true))
      .filter((record) =>
        filters.acceptsDelegation === undefined
          ? true
          : record.clawProfile.acceptsDelegation === filters.acceptsDelegation
      )
      .sort((left, right) => {
        const lastSeenDiff = Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt);
        return lastSeenDiff !== 0 ? lastSeenDiff : left.id.localeCompare(right.id);
      });

    const pagedResults = results.slice(offset, offset + filters.limit);
    const nextOffset = offset + pagedResults.length;

    return {
      results: pagedResults,
      nextCursor: nextOffset < results.length ? encodeCursor(nextOffset) : null
    };
  }

  getAgent(id: string): GetAgentResponse {
    const record = this.database.getRecordById(id);
    if (!record) {
      throw new HttpError(404, "not_found", `agent ${id} was not found`);
    }

    const searchResult = this.toSearchResult(record, this.clock());
    return {
      ...searchResult,
      lastValidatedAt: record.lastValidatedAt,
      heartbeatIntervalSeconds: record.heartbeatIntervalSeconds,
      heartbeatTtlSeconds: record.heartbeatTtlSeconds
    };
  }

  async unregisterAgent(
    request: UnregisterRequest,
    requestTarget: string
  ): Promise<UnregisterResponse> {
    const record = this.database.getRecordById(request.id);
    if (!record) {
      throw new HttpError(404, "not_found", `agent ${request.id} was not found`);
    }

    await this.verifyMutatingRequest({
      method: "POST",
      path: requestTarget,
      body: request,
      signature: request.signature,
      keys: record.signingKeys
    });

    this.database.tombstoneRecord(request.id, this.clock().toISOString());
    return { ok: true };
  }

  private async verifyMutatingRequest(options: {
    method: string;
    path: string;
    body: { signature: RegisterAgentRequest["signature"] | HeartbeatRequest["signature"] | UnregisterRequest["signature"] };
    signature: RegisterAgentRequest["signature"] | HeartbeatRequest["signature"] | UnregisterRequest["signature"];
    keys: StoredRegistryRecord["signingKeys"];
  }): Promise<void> {
    if (options.signature.algorithm !== REGISTRY_SIGNATURE_ALGORITHM) {
      throw new HttpError(401, "invalid_signature", "unsupported signature algorithm");
    }

    const key = resolvePublicKey(options.signature.keyId, options.keys);
    if (!key) {
      throw new HttpError(401, "invalid_signature", "signature keyId is unknown");
    }

    const now = this.clock();
    const signedAtMs = Date.parse(options.signature.timestamp);
    if (!Number.isFinite(signedAtMs)) {
      throw new HttpError(401, "invalid_signature", "signature timestamp is invalid");
    }

    const skewSeconds = Math.abs(now.getTime() - signedAtMs) / 1000;
    if (skewSeconds > this.config.signatureMaxSkewSeconds) {
      throw new HttpError(401, "invalid_signature", "signature timestamp is outside the allowed skew window");
    }

    this.database.pruneExpiredNonces(now.toISOString());
    if (this.database.hasNonce(options.signature.nonce)) {
      throw new HttpError(401, "invalid_signature", "signature nonce has already been used");
    }

    const verified = verifyRegistrySignature({
      method: options.method,
      path: options.path,
      bodyWithoutSignature: withoutSignature(options.body) as RegisterAgentRequest | HeartbeatRequest | UnregisterRequest,
      signature: options.signature,
      publicKey: key.publicKey
    });

    if (!verified) {
      throw new HttpError(401, "invalid_signature", "signature verification failed");
    }

    this.database.saveNonce(
      options.signature.nonce,
      now.toISOString(),
      new Date(now.getTime() + this.config.nonceTtlSeconds * 1000).toISOString()
    );
  }

  private resolveTrustTier(
    agentCardUrl: string,
    existingRecord: StoredRegistryRecord | undefined,
    clawProfile: ClawProfile
  ): TrustTier {
    if (existingRecord?.trustTier === "manually_verified") {
      return "manually_verified";
    }

    const protocol = new URL(agentCardUrl).protocol;
    return protocol === "https:" ? "domain_verified" : "self_attested";
  }

  private toSearchResult(record: StoredRegistryRecord, now: Date): SearchResponse["results"][number] {
    return {
      id: record.id,
      agentCardUrl: record.agentCardUrl,
      agentCardHash: record.agentCardHash,
      agentCardSnapshot: record.agentCardSnapshot,
      clawProfile: record.clawProfile,
      verified: isVerifiedTrustTier(record.trustTier),
      status: computeRegistryStatus(
        record.lastSeenAt,
        record.heartbeatIntervalSeconds,
        record.heartbeatTtlSeconds,
        now
      ),
      lastSeenAt: record.lastSeenAt
    };
  }
}
