export interface ClicheMatch {
  phrase: string;
  tier: 1 | 2;
  weight: number;
  start: number;
  end: number;
}

export const TIER_1_CLICHES: string[] = [
  'delve into',
  'delving into',
  'delves into',
  'tapestry of',
  "in today's fast-paced",
  "in today's rapidly evolving",
  'it is worth noting',
  'it is important to note',
  'it is important to remember',
  'it is important to emphasize',
  'testament to',
  'serves as a testament',
  'realm of',
  'underscore the importance',
  'navigating the complexities',
  'foster a sense of',
  'pivotal role',
  'ever-evolving landscape',
  'comprehensive overview',
  'serves as a reminder',
  'seamless integration',
  'multifaceted',
  'multifaceted nature',
  'embark on a journey',
  'transformative journey',
  'beacon of hope',
  'vibrant tapestry',
  'indelible mark',
  'game-changer',
  'paradigm shift',
  'at the intersection of',
  'cornerstone of',
  'cornerstone in',
];

export const TIER_2_FORMULAIC_OPENERS: string[] = [
  'furthermore,',
  'moreover,',
  'additionally,',
  'in conclusion,',
  'consequently,',
  'notably,',
  'ultimately,',
  'in summary,',
  'to summarize,',
  'importantly,',
  'henceforth,',
];

export const TIER_2_HEDGING_CLUSTERS: string[] = [
  'it can be argued',
  'plays a vital role',
  'plays a crucial role',
  'it is essential to recognize',
  'it is important to remember',
  'it should be emphasized',
  'cannot be overstated',
  'is of paramount importance',
  'serves as a poignant reminder',
  'it is worth mentioning',
  'plays an indispensable role',
];

export const TIER_2_PARTICIPIAL_TAILS: string[] = [
  ', highlighting the',
  ', ensuring that',
  ', fostering a',
  ', underscoring the',
  ', underscoring',
  ', emphasizing the',
  ', shedding light on',
  ', paving the way for',
  ', serving as a',
  ', reflecting the',
];

/**
 * Scans text for Tier 1 and Tier 2 clichés, returning offset matches and weighted sum.
 */
export function scanFingerprints(text: string): {
  matches: ClicheMatch[];
  weightedScore: number;
  tier1Count: number;
  tier2Count: number;
} {
  const matches: ClicheMatch[] = [];
  const lower = text.toLowerCase();

  // Scan Tier 1
  for (const phrase of TIER_1_CLICHES) {
    let pos = 0;
    while ((pos = lower.indexOf(phrase, pos)) !== -1) {
      matches.push({
        phrase,
        tier: 1,
        weight: 1.0,
        start: pos,
        end: pos + phrase.length,
      });
      pos += phrase.length;
    }
  }

  // Scan Tier 2 Openers
  for (const phrase of TIER_2_FORMULAIC_OPENERS) {
    let pos = 0;
    while ((pos = lower.indexOf(phrase, pos)) !== -1) {
      // Must be at start of sentence/paragraph
      const prevChar = pos > 0 ? lower.charAt(pos - 1) : '\n';
      if (/[\n.!?\s]/.test(prevChar)) {
        matches.push({
          phrase,
          tier: 2,
          weight: 0.55,
          start: pos,
          end: pos + phrase.length,
        });
      }
      pos += phrase.length;
    }
  }

  // Scan Tier 2 Hedging Clusters
  for (const phrase of TIER_2_HEDGING_CLUSTERS) {
    let pos = 0;
    while ((pos = lower.indexOf(phrase, pos)) !== -1) {
      matches.push({
        phrase,
        tier: 2,
        weight: 0.55,
        start: pos,
        end: pos + phrase.length,
      });
      pos += phrase.length;
    }
  }

  // Scan Tier 2 Participial Tails
  for (const phrase of TIER_2_PARTICIPIAL_TAILS) {
    let pos = 0;
    while ((pos = lower.indexOf(phrase, pos)) !== -1) {
      matches.push({
        phrase,
        tier: 2,
        weight: 0.55,
        start: pos,
        end: pos + phrase.length,
      });
      pos += phrase.length;
    }
  }

  let tier1Count = 0;
  let tier2Count = 0;
  let totalWeight = 0;

  for (const m of matches) {
    if (m.tier === 1) tier1Count++;
    else tier2Count++;
    totalWeight += m.weight;
  }

  return {
    matches,
    weightedScore: totalWeight,
    tier1Count,
    tier2Count,
  };
}
