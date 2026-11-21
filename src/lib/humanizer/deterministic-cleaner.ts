import { tokenizeSentences, tokenizeWords } from '../nlp/tokenizer';

const CLICHE_REPLACEMENTS: [RegExp, string][] = [
  [/\bin today's fast-paced world\b/gi, 'today'],
  [/\bin today's fast-paced society\b/gi, 'today'],
  [/\bin today's world\b/gi, 'today'],
  [/\bin recent years\b/gi, 'recently'],
  [/\bin recent decades\b/gi, 'recently'],
  [/\bthe concept of\b/gi, ''],
  [/\bdelve into\b/gi, 'examine'],
  [/\bdelves into\b/gi, 'examines'],
  [/\bdelved into\b/gi, 'examined'],
  [/\bdelving into\b/gi, 'examining'],
  [/\b(?:a|the)(?:\s+\w+)?\s+tapestry of\b/gi, 'the structure of'],
  [/\ba tapestry of\b/gi, 'a network of'],
  [/\bthe tapestry of\b/gi, 'the structure of'],
  [/\bvibrant tapestry\b/gi, 'rich mix'],
  [/\btestament to the fact that\b/gi, 'proof that'],
  [/\btestament to\b/gi, 'proof of'],
  [/\bserves as a testament to\b/gi, 'shows'],
  [/\bserves as a reminder of\b/gi, 'reminds us of'],
  [/\bserves as a reminder\b/gi, 'reminds us'],
  [/\bserves as a poignant reminder\b/gi, 'shows clearly'],
  [/\bserves as a stark reminder\b/gi, 'shows clearly'],
  [/\ba stark reminder\b/gi, 'a reminder'],
  [/\bin the realm of\b/gi, 'in'],
  [/\bunderscore the importance of\b/gi, 'highlight'],
  [/\bunderscores the importance of\b/gi, 'highlights'],
  [/\bnavigating the complexities of\b/gi, 'managing'],
  [/\bnavigate the complexities of\b/gi, 'manage'],
  [/\bfoster a sense of belonging\b/gi, 'build belonging'],
  [/\bfoster a sense of\b/gi, 'build'],
  [/\bfosters a sense of\b/gi, 'builds'],
  [/\bfoster a deeper understanding of\b/gi, 'clarify'],
  [/\bfoster a more resilient architecture\b/gi, 'strengthen architecture'],
  [/\bfoster an environment\b/gi, 'build an environment'],
  [/\bfosters an environment\b/gi, 'builds an environment'],
  [/\bplays a pivotal role in\b/gi, 'is essential to'],
  [/\bplay a pivotal role in\b/gi, 'are essential to'],
  [/\bplays a crucial role in\b/gi, 'is key to'],
  [/\bplay a crucial role in\b/gi, 'are key to'],
  [/\bplays a vital role in\b/gi, 'is central to'],
  [/\bplay a vital role in\b/gi, 'are central to'],
  [/\bever-evolving landscape\b/gi, 'changing environment'],
  [/\bever-evolving digital landscape\b/gi, 'modern digital systems'],
  [/\bever-evolving\b/gi, 'evolving'],
  [/\bcomprehensive overview\b/gi, 'clear summary'],
  [/\bcomprehensive analysis\b/gi, 'detailed review'],
  [/\bseamless integration\b/gi, 'clean integration'],
  [/\bmultifaceted nature of\b/gi, 'complexity of'],
  [/\bmultifaceted beauty\b/gi, 'richness'],
  [/\bmultifaceted\b/gi, 'varied'],
  [/\bembark on a journey toward\b/gi, 'work toward'],
  [/\bembark on a journey\b/gi, 'begin'],
  [/\bembarks on a journey\b/gi, 'begins'],
  [/\bcannot be overstated\b/gi, 'is undeniable'],
  [/\bis of paramount importance\b/gi, 'matters deeply'],
  [/\bare of paramount importance\b/gi, 'matter deeply'],
  [/\bare paramount\b/gi, 'matter most'],
  [/\bparadigm shift\b/gi, 'major change'],
  [/\bat the intersection of\b/gi, 'connecting'],
  [/\bvital imperative\b/gi, 'priority'],
  [/\bpresents both unique opportunities and notable challenges for\b/gi, 'brings clear tradeoffs for'],
  [/\bin profound and lasting ways\b/gi, 'deeply'],
];

const THROAT_CLEARING_PREFIXES: [RegExp, string][] = [
  [/^It is worth noting that\s+/i, ''],
  [/^It is important to remember that\s+/i, ''],
  [/^It is essential to recognize that\s+/i, ''],
  [/^It can be argued that\s+/i, ''],
  [/^It should be noted that\s+/i, ''],
  [/^It should be emphasized that\s+/i, ''],
  [/^Furthermore,\s+/i, ''],
  [/^Moreover,\s+/i, ''],
  [/^Additionally,\s+/i, 'Also, '],
  [/^Notably,\s+/i, ''],
  [/^Consequently,\s+/i, 'As a result, '],
  [/^In conclusion,\s+(?:by embracing [^,]+,\s+)?/i, 'In short, '],
  [/^In summary,\s+/i, ''],
  [/^To summarize,\s+/i, ''],
  [/^In recent years,\s+/i, 'Recently, '],
  [/^In recent decades,\s+/i, 'Recently, '],
];

const CONTRACTION_PAIRS: [RegExp, string][] = [
  [/\bdo not\b/g, "don't"],
  [/\bdoes not\b/g, "doesn't"],
  [/\bdid not\b/g, "didn't"],
  [/\bcannot\b/g, "can't"],
  [/\bcan not\b/g, "can't"],
  [/\bwill not\b/g, "won't"],
  [/\bwould not\b/g, "wouldn't"],
  [/\bshould not\b/g, "shouldn't"],
  [/\bcould not\b/g, "couldn't"],
  [/\bis not\b/g, "isn't"],
  [/\bare not\b/g, "aren't"],
  [/\bwas not\b/g, "wasn't"],
  [/\bwere not\b/g, "weren't"],
  [/\bhave not\b/g, "haven't"],
  [/\bhas not\b/g, "hasn't"],
  [/\bhad not\b/g, "hadn't"],
  [/\bit is\b/gi, "it's"],
  [/\bthere is\b/gi, "there's"],
  [/\bthat is\b/gi, "that's"],
  [/\bwhat is\b/gi, "what's"],
];

/**
 * Deterministic De-AI Cleaner.
 */
export function cleanTextDeterministically(
  rawText: string,
  options: {
    injectContractions?: boolean;
    restructureCompoundSentences?: boolean;
    preserveTerms?: string[];
  } = {}
): {
  cleanedText: string;
  changesCount: number;
  replacedPhrases: string[];
} {
  const {
    injectContractions = true,
    restructureCompoundSentences = true,
    preserveTerms = [],
  } = options;

  let text = rawText;
  let changesCount = 0;
  const replacedPhrases: string[] = [];

  // Protect preserved terms
  const termMap = new Map<string, string>();
  preserveTerms.forEach((term, idx) => {
    if (term.trim().length > 0) {
      const placeholder = `__PRESERVED_TERM_${idx}__`;
      termMap.set(placeholder, term);
      const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
      text = text.replace(regex, placeholder);
    }
  });

  // Step 1: Replace clichés
  for (const [pattern, replacement] of CLICHE_REPLACEMENTS) {
    const matches = text.match(pattern);
    if (matches) {
      changesCount += matches.length;
      replacedPhrases.push(...matches);
      text = text.replace(pattern, replacement);
    }
  }

  // Step 2: Sentence-level transformations
  const sentences = tokenizeSentences(text);
  const processedSentences: string[] = [];

  for (let idx = 0; idx < sentences.length; idx++) {
    let s = sentences[idx]!.text.trim();

    // Prune throat clearing
    for (const [prefixPattern, replacement] of THROAT_CLEARING_PREFIXES) {
      if (prefixPattern.test(s)) {
        s = s.replace(prefixPattern, replacement);
        changesCount++;
      }
    }

    // Capitalize first letter
    if (s.length > 0 && /^[a-z]/.test(s)) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }

    // Convert common robotic passives
    s = s.replace(
      /\b(is|are) utilized by\b/gi,
      (_, v) => (v.toLowerCase() === 'is' ? 'serves' : 'serve')
    );
    s = s.replace(/\bwas conducted by\b/gi, 'came from');

    // Participial tails
    if (/, highlighting (?:the )?(.*?)([.!?]|$)/i.test(s)) {
      s = s.replace(/, highlighting (?:the )?(.*?)([.!?]|$)/i, '. This highlights $1$2');
      changesCount++;
    } else if (/, fostering (?:a )?(.*?)([.!?]|$)/i.test(s)) {
      s = s.replace(/, fostering (?:a )?(.*?)([.!?]|$)/i, '. This builds $1$2');
      changesCount++;
    } else if (/, underscoring (?:the )?(.*?)([.!?]|$)/i.test(s)) {
      s = s.replace(/, underscoring (?:the )?(.*?)([.!?]|$)/i, '. This clarifies $1$2');
      changesCount++;
    }

    // De-construct robotic rule of three "A, B, and C" into "A and B, alongside C"
    s = s.replace(/\b(\w+),\s+(\w+),\s+and\s+(\w+)\b/gi, '$1 and $2, alongside $3');

    // Step 3: Break overly long compound sentences (> 25 words) to increase burstiness
    const wordList = tokenizeWords(s);
    if (restructureCompoundSentences && wordList.length > 25) {
      const breakMatch = s.match(/(.*?),\s+(and|while|whereby|which)\s+(.*)/i);
      if (breakMatch && breakMatch[1] && breakMatch[2] && breakMatch[3]) {
        const first = breakMatch[1].trim();
        const second = breakMatch[3].trim();
        if (tokenizeWords(first).length >= 7 && tokenizeWords(second).length >= 5) {
          const capitalizedSecond = second.charAt(0).toUpperCase() + second.slice(1);
          s = `${first}. ${capitalizedSecond}`;
          changesCount++;
        }
      }
    }

    // Step 4: Inject contractions
    if (injectContractions) {
      for (const [pattern, contraction] of CONTRACTION_PAIRS) {
        if (pattern.test(s)) {
          s = s.replace(pattern, contraction);
          changesCount++;
        }
      }
    }

    processedSentences.push(s);
  }

  // Break robotic rhythm if all sentences are monotonous in length
  if (processedSentences.length >= 4) {
    const lengths = processedSentences.map((s) => tokenizeWords(s).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const stdDev = Math.sqrt(lengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / lengths.length);
    const cv = mean > 0 ? stdDev / mean : 0;

    // If still excessively uniform (CV < 0.32), merge first two short sentences to introduce asymmetric burstiness
    if (cv < 0.32 && processedSentences.length >= 4) {
      const s0Words = tokenizeWords(processedSentences[0]!).length;
      const s1Words = tokenizeWords(processedSentences[1]!).length;
      if (s0Words < 14 && s1Words < 14) {
        const merged = `${processedSentences[0]!.replace(/[.!?]$/, '')}; moreover, ${processedSentences[1]!.charAt(0).toLowerCase() + processedSentences[1]!.slice(1)}`;
        processedSentences.splice(0, 2, merged);
      }
    }
  }

  let cleanedText = processedSentences.join(' ');

  // Restore preserved terms
  termMap.forEach((original, placeholder) => {
    cleanedText = cleanedText.replaceAll(placeholder, original);
  });

  // Clean double spaces
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim();

  return {
    cleanedText,
    changesCount,
    replacedPhrases: Array.from(new Set(replacedPhrases)),
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
