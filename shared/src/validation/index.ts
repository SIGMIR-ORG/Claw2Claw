import Ajv2020Import, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsImport from "ajv-formats";

import agentCardSchema from "../../../spec/agent-card.schema.json" with { type: "json" };
import clawProfileSchema from "../../../spec/claw-profile.schema.json" with { type: "json" };

const Ajv2020 = Ajv2020Import as unknown as new (options?: Record<string, unknown>) => {
  compile: <T>(schema: unknown) => ValidateFunction<T>;
};
const addFormats = addFormatsImport as unknown as (ajv: object) => void;

const ajv = new Ajv2020({
  allErrors: true,
  strict: false
});

addFormats(ajv);

export const validateAgentCardSchema = ajv.compile(agentCardSchema);
export const validateClawProfileSchema = ajv.compile(clawProfileSchema);

export interface ValidationFailure {
  message: string;
  errors: ErrorObject[];
}

export function validationErrorMessage(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) {
    return "validation failed";
  }

  return errors
    .map((error) => {
      const instancePath = error.instancePath || "/";
      return `${instancePath} ${error.message ?? "is invalid"}`.trim();
    })
    .join("; ");
}

export function assertValid<T>(validator: ValidateFunction<T>, value: unknown, label: string): T {
  if (validator(value)) {
    return value as T;
  }

  throw new Error(`${label} ${validationErrorMessage(validator.errors)}`);
}
