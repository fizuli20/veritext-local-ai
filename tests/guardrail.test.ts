import { describe, it, expect } from 'vitest';
import { validateGuardrails, extractFactualEntities } from '@/lib/humanizer/guardrail';

describe('Entity & Integrity Guardrail', () => {
  it('extracts factual entities accurately', () => {
    const text = 'In 2024, inflation reached 4.2% while harbor logs showed $185,000 in Berth 9.';
    const entities = extractFactualEntities(text);

    expect(entities.has('2024')).toBe(true);
    expect(entities.has('4.2%')).toBe(true);
    expect(entities.has('$185,000')).toBe(true);
    expect(entities.has('9')).toBe(true);
  });

  it('detects when an entity has been omitted or mutated in rewrite', () => {
    const original = 'Revenue reached $185,000 in 2023 with 14.5% margin.';
    const tampered = 'Revenue reached $120,000 with good margins.';

    const result = validateGuardrails(original, tampered);
    expect(result.passed).toBe(false);
    expect(result.missingEntities).toContain('2023');
    expect(result.missingEntities).toContain('14.5%');
    expect(result.missingEntities).toContain('$185,000');
  });

  it('detects missing user locked terms', () => {
    const original = 'We integrated with Snowflake and Stripe for billing.';
    const rewritten = 'We integrated with modern databases and payment gateways.';

    const result = validateGuardrails(original, rewritten, {
      preserveTerms: ['Snowflake', 'Stripe'],
    });

    expect(result.passed).toBe(false);
    expect(result.missingPreservedTerms).toContain('Snowflake');
    expect(result.missingPreservedTerms).toContain('Stripe');
  });

  it('catches severe length collapse exceeding threshold unless concise mode', () => {
    const original = 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen.';
    const collapsed = 'One two three.';

    const resultStandard = validateGuardrails(original, collapsed, {
      mode: 'standard',
      maxAllowedLengthCollapse: 0.35,
    });
    expect(resultStandard.passed).toBe(false);
    expect(resultStandard.violations.some((v) => v.includes('collapsed'))).toBe(true);

    const resultConcise = validateGuardrails(original, collapsed, {
      mode: 'concise',
    });
    // In concise mode, length reduction is allowed
    expect(resultConcise.violations.some((v) => v.includes('collapsed'))).toBe(false);
  });
});
