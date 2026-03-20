/* eslint-disable */
/* This file is generated from local Claw2Claw specs. */

export interface paths {
    "/v1/agents/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Register an agent */
        post: operations["registerAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/agents/heartbeat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record agent liveness */
        post: operations["heartbeatAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/agents/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search visible registered agents */
        get: operations["searchAgents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/agents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a single agent by id */
        get: operations["getAgent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/agents/unregister": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Unregister an agent */
        post: operations["unregisterAgent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @enum {string} */
        RegistryStatus: "online" | "stale" | "offline";
        /** @enum {string} */
        TrustTier: "self_attested" | "domain_verified" | "manually_verified";
        RegistrySignature: {
            keyId: string;
            /** @constant */
            algorithm: "ed25519";
            /** Format: date-time */
            timestamp: string;
            nonce: string;
            value: string;
        };
        ErrorEnvelope: {
            error: {
                code: string;
                message: string;
            };
        };
        RegisterAgentRequest: {
            /** Format: uri */
            agentCardUrl: string;
            agentCard: components["schemas"]["agent-card.schema"];
            clawProfile: components["schemas"]["claw-profile.schema"];
            signature: components["schemas"]["RegistrySignature"];
        };
        RegisterAgentResponse: {
            /** Format: uuid */
            id: string;
            trustTier: components["schemas"]["TrustTier"];
            heartbeatIntervalSeconds: number;
            heartbeatTtlSeconds: number;
        };
        HeartbeatRequest: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "online";
            load?: number;
            activeTasks?: number;
            signature: components["schemas"]["RegistrySignature"];
        };
        HeartbeatResponse: {
            /** @enum {string} */
            status: "online";
            /** Format: date-time */
            recordedAt: string;
            /** Format: date-time */
            nextHeartbeatDeadlineAt: string;
        };
        SearchResult: {
            /** Format: uuid */
            id: string;
            /** Format: uri */
            agentCardUrl: string;
            agentCardHash: string;
            agentCardSnapshot: components["schemas"]["agent-card.schema"];
            clawProfile: components["schemas"]["claw-profile.schema"];
            verified: boolean;
            status: components["schemas"]["RegistryStatus"];
            /** Format: date-time */
            lastSeenAt: string;
        };
        SearchResponse: {
            results: components["schemas"]["SearchResult"][];
            nextCursor: string | null;
        };
        GetAgentResponse: components["schemas"]["SearchResult"] & {
            /** Format: date-time */
            lastValidatedAt: string;
            heartbeatIntervalSeconds: number;
            heartbeatTtlSeconds: number;
        };
        UnregisterRequest: {
            /** Format: uuid */
            id: string;
            signature: components["schemas"]["RegistrySignature"];
        };
        UnregisterResponse: {
            /** @constant */
            ok: true;
        };
        PublicSigningKey: {
            id: string;
            /** @constant */
            algorithm: "ed25519";
            publicKey: string;
        };
        AgentSkill: {
            id: string;
            name: string;
            description: string;
            tags: string[];
            examples?: string[];
            inputModes?: string[];
            outputModes?: string[];
            security?: Record<string, never>[];
        } & {
            [key: string]: unknown;
        };
        Claw2ClawRegistryExtension: {
            keys: components["schemas"]["PublicSigningKey"][];
        };
        /**
         * Claw2Claw Registered Agent Card
         * @description Local validation subset for A2A 0.3.0 Agent Cards registered with Claw2Claw. Full runtime validation MUST also validate against the official A2A 0.3.0 AgentCard contract.
         */
        "agent-card.schema": {
            /** @constant */
            protocolVersion: "0.3.0";
            name: string;
            description: string;
            /** Format: uri */
            url: string;
            /** @constant */
            preferredTransport: "JSONRPC";
            version: string;
            capabilities: {
                streaming: boolean;
                /** @constant */
                pushNotifications: false;
            } & {
                [key: string]: unknown;
            };
            securitySchemes: {
                bearerAuth: {
                    /** @constant */
                    type: "http";
                    /** @constant */
                    scheme: "bearer";
                    /** @constant */
                    bearerFormat: "opaque";
                };
            };
            security: {
                bearerAuth: unknown[];
            }[];
            defaultInputModes: string[];
            defaultOutputModes: string[];
            skills: components["schemas"]["AgentSkill"][];
            /** @constant */
            supportsAuthenticatedExtendedCard?: false;
            additionalInterfaces?: unknown[];
            claw2clawRegistry: components["schemas"]["Claw2ClawRegistryExtension"];
            $defs: {
                AgentSkill: {
                    id: string;
                    name: string;
                    description: string;
                    tags: string[];
                    examples?: string[];
                    inputModes?: string[];
                    outputModes?: string[];
                    security?: Record<string, never>[];
                } & {
                    [key: string]: unknown;
                };
                PublicSigningKey: {
                    id: string;
                    /** @constant */
                    algorithm: "ed25519";
                    publicKey: string;
                };
                Claw2ClawRegistryExtension: {
                    keys: components["schemas"]["PublicSigningKey"][];
                };
            };
        } & {
            [key: string]: unknown;
        };
        /**
         * Claw2Claw Profile
         * @description Registry-owned metadata for Claw2Claw discovery, trust filtering, and local policy hints.
         */
        "claw-profile.schema": {
            /** @enum {string} */
            visibility: "public" | "private";
            /** @enum {string} */
            trustTier?: "self_attested" | "domain_verified" | "manually_verified";
            /** @enum {string} */
            ownerType: "personal" | "organization" | "service";
            acceptsDelegation: boolean;
            requiresApprovalForSensitiveActions: boolean;
            /** @constant */
            relayRequired: false;
            region: string;
            languages: string[];
            tags: string[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    registerAgent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterAgentRequest"];
            };
        };
        responses: {
            /** @description Agent registered */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegisterAgentResponse"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Invalid signature */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    heartbeatAgent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HeartbeatRequest"];
            };
        };
        responses: {
            /** @description Heartbeat accepted */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HeartbeatResponse"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Invalid signature */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    searchAgents: {
        parameters: {
            query?: {
                skill?: string;
                verified?: boolean;
                region?: string;
                status?: components["schemas"]["RegistryStatus"];
                acceptsDelegation?: boolean;
                limit?: number;
                cursor?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Search results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResponse"];
                };
            };
        };
    };
    getAgent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Agent record */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAgentResponse"];
                };
            };
            /** @description Agent not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
    unregisterAgent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UnregisterRequest"];
            };
        };
        responses: {
            /** @description Agent unregistered */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnregisterResponse"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            /** @description Invalid signature */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
}
