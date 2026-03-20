import { A2AError } from "@a2a-js/sdk/server";

import type { Skill } from "../bridge/openclaw-bridge.js";

export interface PublicSkillPolicy {
  publicSkillIds: Set<string>;
}

export function createPublicSkillPolicy(skillIds: string[]): PublicSkillPolicy {
  return {
    publicSkillIds: new Set(skillIds)
  };
}

export function filterPublicSkills(skills: Skill[], policy: PublicSkillPolicy): Skill[] {
  return skills.filter((skill) => policy.publicSkillIds.has(skill.id));
}

export function resolveRequestedSkillId(
  message: unknown,
  policy: PublicSkillPolicy,
  publicSkills: Skill[]
): string {
  const metadataSkillId =
    typeof message === "object" && message !== null && "metadata" in message
      ? (message as { metadata?: { skillId?: unknown } }).metadata?.skillId
      : undefined;
  const requestedSkillId = typeof metadataSkillId === "string" ? metadataSkillId : undefined;

  if (requestedSkillId && !policy.publicSkillIds.has(requestedSkillId)) {
    throw A2AError.invalidRequest("policy_denied", { skillId: requestedSkillId });
  }

  if (requestedSkillId) {
    return requestedSkillId;
  }

  if (publicSkills.length === 0) {
    throw A2AError.invalidRequest("policy_denied", { reason: "no_public_skills" });
  }

  const defaultSkill = publicSkills[0];
  if (!defaultSkill) {
    throw A2AError.invalidRequest("policy_denied", { reason: "no_public_skills" });
  }

  return defaultSkill.id;
}
