/**
 * Robust output sanitization for local LLM outputs (LM Studio, Ollama, WebLLM).
 * Strips reasoning tokens (<think>, <thought>), accidental preambles, and conversational artifacts.
 */

const THINKING_TAG_REGEXES = [
  /<think>[\s\S]*?<\/think>/gi,
  /<thought>[\s\S]*?<\/thought>/gi,
  /<\|thought\|>[\s\S]*?<\|thought\|>/gi,
  /\[THOUGHT\][\s\S]*?\[\/THOUGHT\]/gi,
];

const PREAMBLE_REGEXES = [
  /^(?:here(?:'s| is) (?:a |the )?(?:rewritten|humanized|revised|updated|edited)? ?(?:version|text|draft|passage|response)?(?: of (?:the |this )?(?:text|passage|article|draft))?(?::|\n+))/i,
  /^(?:sure!?|certainly!?|of course!?)(?:, )?(?:here(?:'s| is) (?:a |the )?(?:rewritten|revised|humanized)? ?(?:text|version)?(?: of (?:the |this )?(?:text|passage))?(?::|\n+))/i,
  /^(?:below is (?:the|a) (?:rewritten|humanized|revised) (?:version|text)(?: of (?:the |this )?(?:text|passage))?(?::|\n+))/i,
  /^(?:i(?:'ve| have) (?:rewritten|humanized|revised) (?:this|the text|the passage)(?::|\n+))/i,
];

const POSTAMBLE_REGEXES = [
  /\n+(?:hope this helps!?|let me know if you (?:need|would like) any (?:changes|edits|adjustments)|feel free to ask).*$/i,
  /\n+(?:note:.*|summary of changes:.*)$/i,
];

/**
 * Strips reasoning tags, markdown code wrappers (if LLM wrapped entire response in ```markdown),
 * and introductory/concluding chat conversational filler.
 */
export function cleanLlmOutput(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText.trim();

  // 1. Strip thinking tags
  for (const regex of THINKING_TAG_REGEXES) {
    cleaned = cleaned.replace(regex, '').trim();
  }

  // 2. Strip unclosed leading thinking tags (e.g. if streaming cutoff)
  cleaned = cleaned.replace(/^(?:<think>|<thought>|<\|thought\|>)[\s\S]*?(?:<\/think>|<\/thought>|<\|thought\|>)?/i, '').trim();

  // 3. Strip code fence blocks if LLM wrapped whole prose in ```...```
  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    const lines = cleaned.split('\n');
    if (lines.length >= 2) {
      cleaned = lines.slice(1, -1).join('\n').trim();
    }
  }

  // 4. Strip conversational preambles
  for (const regex of PREAMBLE_REGEXES) {
    cleaned = cleaned.replace(regex, '').trim();
  }

  // 5. Strip trailing conversational postambles
  for (const regex of POSTAMBLE_REGEXES) {
    cleaned = cleaned.replace(regex, '').trim();
  }

  // 6. Strip leading/trailing matching quotes if the LLM quoted the whole output
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) ||
    (cleaned.startsWith('“') && cleaned.endsWith('”') && cleaned.length > 2)
  ) {
    // Only strip if there are no internal unescaped matching quotes
    const quoteCount = (cleaned.match(/"/g) || []).length;
    if (quoteCount === 2) {
      cleaned = cleaned.slice(1, -1).trim();
    }
  }

  return cleaned;
}

/**
 * Helper to process streaming SSE deltas:
 * Skips reasoning_content or reasoning deltas, and accumulates content deltas.
 */
export function extractDeltaContent(choiceDelta: any): string {
  if (!choiceDelta) return '';
  // Ignore reasoning deltas from thinking models (DeepSeek-R1, Qwen-Thinking, etc.)
  if (choiceDelta.reasoning_content || choiceDelta.reasoning) {
    return '';
  }
  return typeof choiceDelta.content === 'string' ? choiceDelta.content : '';
}
