export type HumanizerMode =
  | 'standard'
  | 'academic'
  | 'casual'
  | 'professional'
  | 'creative'
  | 'concise'
  | 'expanded';

export interface ModePromptConfig {
  mode: HumanizerMode;
  label: string;
  description: string;
  systemInstruction: string;
  fewShotExample: {
    before: string;
    after: string;
  };
}

export const MODE_CONFIGS: Record<HumanizerMode, ModePromptConfig> = {
  standard: {
    mode: 'standard',
    label: 'Standard',
    description: 'Natural, balanced human flow with dynamic sentence rhythm and zero fluff.',
    systemInstruction: `You are an expert human prose editor. Your single task is to rewrite AI-generated text into authentic, natural human writing.
RULES:
1. Vary sentence length dramatically: interleave short 4-8 word sentences with longer descriptive sentences (18-24 words).
2. NEVER use AI clichés like "in today's fast-paced world", "delve into", "tapestry of", "testament to", "pivotal role", "realm of", "multifaceted", "ever-evolving".
3. NEVER start consecutive sentences with formulaic openers ("Furthermore", "Moreover", "Additionally", "In conclusion").
4. PRESERVE 100% of facts, dates, numbers, percentages, and proper nouns exactly as written.
5. Return ONLY the rewritten text. Do NOT add conversational greetings, introductions, or closing remarks.`,
    fewShotExample: {
      before: `In today's fast-paced digital world, cloud computing plays a pivotal role in enabling organizations to navigate complex operational challenges. Furthermore, it is worth noting that distributed systems foster greater scalability and efficiency across enterprise teams.`,
      after: `Modern teams run on cloud infrastructure. Without it, scaling across regions gets messy fast. Distributed servers don't just cut hosting overhead; they let engineers deploy updates without taking production offline.`,
    },
  },
  academic: {
    mode: 'academic',
    label: 'Academic',
    description: 'Scholarly, rigorous, and precise without formulaic transitions or robotic filler.',
    systemInstruction: `You are a scholarly peer-review editor. Rewrite the text into rigorous, disciplined academic prose.
RULES:
1. Eliminate vague generalities ("multifaceted nature", "crucial role", "in the realm of"). Replace them with precise domain mechanisms.
2. Maintain scholarly precision. Use concrete passive or active constructions where appropriate, but avoid repetitive robotic padding.
3. PRESERVE all citations, data points, statistics, equations, and technical terminology exactly.
4. Vary sentence syntax: combine subordinate causal clauses with direct empirical claims.
5. Output ONLY the rewritten text without commentary.`,
    fewShotExample: {
      before: `In the realm of machine learning, neural networks play a crucial role in image recognition. Furthermore, it is important to remember that convolutional layers provide a comprehensive overview of visual patterns, highlighting the significance of feature extraction.`,
      after: `Convolutional architectures isolate spatial hierarchies in image arrays through localized kernel convolutions. Rather than analyzing unweighted pixel grids globally, successive filter banks compress low-level edges into invariant feature representations.`,
    },
  },
  casual: {
    mode: 'casual',
    label: 'Casual',
    description: 'Conversational, warm, and engaging with natural contractions and colloquial rhythm.',
    systemInstruction: `You are rewriting text to sound like an intelligent, articulate friend speaking naturally.
RULES:
1. Use natural contractions (don't, can't, it's, we've, you'll).
2. Ban all corporate and AI jargon. Use punchy, conversational phrasing.
3. Keep sentences lively and rhythmic. Add genuine human tone and relatable pacing.
4. Keep all figures, dates, and proper names accurate.
5. Output ONLY the rewritten prose.`,
    fewShotExample: {
      before: `It can be argued that preparing meals at home fosters a sense of personal satisfaction and promotes healthier nutritional habits in individuals. Moreover, culinary activities underscore the importance of spending quality time with family members.`,
      after: `Cooking at home just feels better. You know what's going into your food, and honestly, throwing together dinner with someone you like beats waiting forty minutes for lukewarm takeout every single time.`,
    },
  },
  professional: {
    mode: 'professional',
    label: 'Professional',
    description: 'Crisp, authoritative business communication focused on actionable impact.',
    systemInstruction: `You are an executive communications director. Rewrite the text for high-impact professional readers.
RULES:
1. Cut bureaucratic fluff and throat-clearing openers ("It is worth noting that", "It is important to recognize").
2. Focus on clarity, direct action, and measurable outcomes.
3. Use active voice and sharp verbs. Keep sentences lean (12-20 words).
4. PRESERVE all business metrics, dates, percentages, and client names.
5. Output ONLY the polished text.`,
    fewShotExample: {
      before: `Furthermore, our company is dedicated to navigating the complexities of customer service to ensure seamless integration and foster long-term client relationships in an ever-evolving market landscape.`,
      after: `We simplified our onboarding workflow last quarter. Clients now resolve support tickets in under ten minutes, directly reducing churn across enterprise accounts.`,
    },
  },
  creative: {
    mode: 'creative',
    label: 'Creative',
    description: 'Evocative, sensory, and stylistically distinct with organic imagery.',
    systemInstruction: `You are an author crafting evocative literary prose.
RULES:
1. Replace generic abstractions with sensory, concrete details and fresh metaphors.
2. Avoid all predictable LLM phrases ("tapestry", "beacon", "symphony of", "journey").
3. Use asymmetrical cadence: pair unexpected descriptions with sharp cadence shifts.
4. Keep core narrative facts and named entities intact.
5. Output ONLY the rewritten prose.`,
    fewShotExample: {
      before: `The old library was a testament to the town's history, serving as a beacon of knowledge and fostering a vibrant tapestry of community connections throughout the years.`,
      after: `Cedar dust and damp paper hung thick between the oak stacks. For eighty winters, the library held the town's quietest hours, its warped floorboards groaning under schoolkids and retirees alike.`,
    },
  },
  concise: {
    mode: 'concise',
    label: 'Concise',
    description: 'Tight, zero-waste editing that preserves core meaning in fewer words.',
    systemInstruction: `You are a ruthless copy editor. Cut all excess words while preserving the exact core message.
RULES:
1. Remove all throat-clearing, redundant adverbs, and filler phrases.
2. Shorten sentences. Make every word justify its presence.
3. Keep 100% of factual claims, numbers, and proper nouns.
4. Output ONLY the condensed text.`,
    fewShotExample: {
      before: `In order to effectively optimize the overall performance of the database system, it is necessary for database administrators to conduct a comprehensive analysis of recurring query latency patterns.`,
      after: `To speed up the database, administrators must analyze query latency patterns.`,
    },
  },
  expanded: {
    mode: 'expanded',
    label: 'Expanded',
    description: 'Elaborates on ideas with authentic nuance, examples, and contextual depth.',
    systemInstruction: `You are an essayist adding thoughtful nuance and concrete grounding to the text.
RULES:
1. Expand on ideas by illustrating concrete mechanisms, real-world examples, and human stakes.
2. Do NOT pad with empty adjectives or AI clichés. Add genuine substance and analytical depth.
3. Retain all original facts and data points.
4. Output ONLY the expanded text.`,
    fewShotExample: {
      before: `Electric vehicles help lower emissions. Battery recycling will also become more important.`,
      after: `Electric vehicles reduce tailpipe emissions instantly, but their full environmental equation depends on what happens after ten years on the road. As battery packs degrade, regional recycling hubs must recover rare lithium and cobalt before spent cells end up in municipal landfills.`,
    },
  },
};

/**
 * Builds the complete prompt for WebLLM local inference.
 */
export function buildHumanizerPrompt(
  text: string,
  mode: HumanizerMode = 'standard',
  intensity: number = 0.8,
  preserveTerms: string[] = []
): { system: string; user: string } {
  const config = MODE_CONFIGS[mode] || MODE_CONFIGS.standard;

  let termsInstruction = '';
  if (preserveTerms.length > 0) {
    termsInstruction = `\nLOCKED TERMS: You MUST retain these exact terms verbatim without modification: ${preserveTerms.map((t) => `"${t}"`).join(', ')}.`;
  }

  const intensityNote =
    intensity > 0.85
      ? '\nAGGRESSIVE HUMANIZATION: Completely restructure sentences and rephrase thoughts to eliminate all AI rhythm.'
      : '\nBALANCED HUMANIZATION: Preserve original meaning closely while restructuring rhythm and eliminating clichés.';

  const system = `${config.systemInstruction}${termsInstruction}${intensityNote}

FEW-SHOT EXAMPLE:
[AI Text]: ${config.fewShotExample.before}
[Rewritten]: ${config.fewShotExample.after}`;

  const user = `Rewrite this text now:\n\n${text}`;

  return { system, user };
}

/**
 * Strips accidental conversational preambles from local LLM outputs.
 */
export function cleanModelPreamble(output: string): string {
  let cleaned = output.trim();

  // Strip leading conversational preambles like "Here is the rewritten text:" or "Sure! Here is the revised version:"
  cleaned = cleaned.replace(
    /^(?:Here (?:is|are) (?:the|a) (?:rewritten|revised|humanized|cleaned) (?:version|text|passage|prose):?|Sure[,!]? here (?:is|are)[^:]*:?|Certainly[,!]? here[^:]*:?|Rewritten text:?)\s*/i,
    ''
  );

  // Strip wrapping quotation marks if model wrapped the entire response
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}
