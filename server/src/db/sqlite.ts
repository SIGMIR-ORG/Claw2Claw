import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { PublicSigningKey } from "../../../shared/src/index.js";
import type { ClawProfile, RegisteredAgentCard, StoredRegistryRecord } from "../models/registry.js";

import { INIT_SQL } from "./migrate.js";

interface AgentRecordRow {
  id: string;
  agent_card_url: string;
  agent_card_hash: string;
  agent_card_snapshot: string;
  claw_profile: string;
  trust_tier: StoredRegistryRecord["trustTier"];
  signing_keys: string;
  last_seen_at: string;
  last_validated_at: string;
  heartbeat_interval_seconds: number;
  heartbeat_ttl_seconds: number;
  created_at: string;
  updated_at: string;
  tombstoned_at: string | null;
}

export class RegistryDatabase {
  private readonly database: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    this.database = new DatabaseSync(dbPath);
    this.database.exec(INIT_SQL);
  }

  close(): void {
    this.database.close();
  }

  pruneExpiredNonces(nowIso: string): void {
    this.database.prepare("DELETE FROM used_nonces WHERE expires_at <= ?").run(nowIso);
  }

  hasNonce(nonce: string): boolean {
    const row = this.database.prepare("SELECT nonce FROM used_nonces WHERE nonce = ?").get(nonce) as
      | { nonce: string }
      | undefined;
    return row !== undefined;
  }

  saveNonce(nonce: string, firstSeenAt: string, expiresAt: string): void {
    this.database
      .prepare(
        "INSERT INTO used_nonces (nonce, first_seen_at, expires_at) VALUES (?, ?, ?)"
      )
      .run(nonce, firstSeenAt, expiresAt);
  }

  getRecordById(id: string): StoredRegistryRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM agent_records WHERE id = ? AND tombstoned_at IS NULL")
      .get(id) as AgentRecordRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  listActiveRecords(): StoredRegistryRecord[] {
    const rows = this.database
      .prepare("SELECT * FROM agent_records WHERE tombstoned_at IS NULL")
      .all() as unknown as AgentRecordRow[];
    return rows.map((row) => this.mapRow(row));
  }

  findRecordByAgentCardUrl(agentCardUrl: string): StoredRegistryRecord | undefined {
    const rows = this.database
      .prepare(
        "SELECT * FROM agent_records WHERE agent_card_url = ? AND tombstoned_at IS NULL ORDER BY created_at DESC"
      )
      .all(agentCardUrl) as unknown as AgentRecordRow[];
    return rows[0] ? this.mapRow(rows[0]) : undefined;
  }

  upsertRecord(record: StoredRegistryRecord): void {
    this.database
      .prepare(
        `INSERT INTO agent_records (
          id,
          agent_card_url,
          agent_card_hash,
          agent_card_snapshot,
          claw_profile,
          trust_tier,
          signing_keys,
          last_seen_at,
          last_validated_at,
          heartbeat_interval_seconds,
          heartbeat_ttl_seconds,
          created_at,
          updated_at,
          tombstoned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          agent_card_url = excluded.agent_card_url,
          agent_card_hash = excluded.agent_card_hash,
          agent_card_snapshot = excluded.agent_card_snapshot,
          claw_profile = excluded.claw_profile,
          trust_tier = excluded.trust_tier,
          signing_keys = excluded.signing_keys,
          last_seen_at = excluded.last_seen_at,
          last_validated_at = excluded.last_validated_at,
          heartbeat_interval_seconds = excluded.heartbeat_interval_seconds,
          heartbeat_ttl_seconds = excluded.heartbeat_ttl_seconds,
          updated_at = excluded.updated_at,
          tombstoned_at = excluded.tombstoned_at`
      )
      .run(
        record.id,
        record.agentCardUrl,
        record.agentCardHash,
        JSON.stringify(record.agentCardSnapshot),
        JSON.stringify(record.clawProfile),
        record.trustTier,
        JSON.stringify(record.signingKeys),
        record.lastSeenAt,
        record.lastValidatedAt,
        record.heartbeatIntervalSeconds,
        record.heartbeatTtlSeconds,
        record.createdAt,
        record.updatedAt,
        record.tombstonedAt
      );
  }

  tombstoneRecord(id: string, tombstonedAt: string): void {
    this.database
      .prepare(
        "UPDATE agent_records SET tombstoned_at = ?, updated_at = ? WHERE id = ? AND tombstoned_at IS NULL"
      )
      .run(tombstonedAt, tombstonedAt, id);
  }

  private mapRow(row: AgentRecordRow): StoredRegistryRecord {
    return {
      id: row.id,
      agentCardUrl: row.agent_card_url,
      agentCardHash: row.agent_card_hash,
      agentCardSnapshot: JSON.parse(row.agent_card_snapshot) as RegisteredAgentCard,
      clawProfile: JSON.parse(row.claw_profile) as ClawProfile,
      trustTier: row.trust_tier,
      signingKeys: JSON.parse(row.signing_keys) as PublicSigningKey[],
      lastSeenAt: row.last_seen_at,
      lastValidatedAt: row.last_validated_at,
      heartbeatIntervalSeconds: row.heartbeat_interval_seconds,
      heartbeatTtlSeconds: row.heartbeat_ttl_seconds,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tombstonedAt: row.tombstoned_at
    };
  }
}
