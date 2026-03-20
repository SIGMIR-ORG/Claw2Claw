/* eslint-disable */
/* This file is generated from local Claw2Claw specs. */

/**
 * Registry-owned metadata for Claw2Claw discovery, trust filtering, and local policy hints.
 */
export interface Claw2ClawProfile {
  visibility: 'public' | 'private';
  trustTier?: 'self_attested' | 'domain_verified' | 'manually_verified';
  ownerType: 'personal' | 'organization' | 'service';
  acceptsDelegation: boolean;
  requiresApprovalForSensitiveActions: boolean;
  relayRequired: false;
  region: string;
  /**
   * @minItems 1
   */
  languages: [string, ...string[]];
  tags: string[];
}
