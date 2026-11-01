import { OrderSpecSchema, type OrderSpec } from './spec.js';

export class SpecParseError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = 'SpecParseError';
  }
}

/** Pull one JSON object out of model text. Accepts a bare object or one fenced block, nothing else. */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  const candidate = fenced?.[1] ?? trimmed;
  if (!candidate.startsWith('{') || !candidate.endsWith('}')) {
    throw new SpecParseError('model output is not a single JSON object');
  }
  try {
    return JSON.parse(candidate);
  } catch (e) {
    throw new SpecParseError(`model output is not valid JSON: ${(e as Error).message}`);
  }
}

/** Validate model output into an OrderSpec. Any unknown field, missing field or ambiguity fails. */
export function parseOrderSpec(text: string): OrderSpec {
  const raw = extractJsonObject(text);
  const result = OrderSpecSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new SpecParseError(`order spec failed validation: ${issues.join('; ')}`, issues);
  }
  return result.data;
}
