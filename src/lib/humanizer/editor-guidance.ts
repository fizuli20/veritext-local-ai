import { countWords, tokenizeSentences } from "../nlp/tokenizer";
import { extractVoiceFingerprint } from "../nlp/voice-profile";

export const VOICE_SAMPLE_LIMIT = 2400;
export const VOICE_SAMPLE_MIN_WORDS = 40;

export function describeVoiceSample(sample: string): string {
  const text = sample.slice(0, VOICE_SAMPLE_LIMIT).trim();
  if (
    countWords(text) < VOICE_SAMPLE_MIN_WORDS ||
    tokenizeSentences(text).length < 2
  )
    return "";
  const voice = extractVoiceFingerprint(text.replace(/[’‘]/g, "'"));
  return [
    voice.meanSentenceLength < 13
      ? "Favor short, direct sentences."
      : voice.meanSentenceLength > 21
        ? "Use longer connected sentences where they improve flow."
        : "Favor medium-length sentences.",
    voice.sentenceLengthCV >= 0.45
      ? "Vary the rhythm with a mix of short and longer sentences."
      : "Use a fairly steady sentence rhythm.",
    voice.contractionRate
      ? "Natural contractions suit this voice where appropriate."
      : "Prefer full forms for contractions.",
    voice.avgWordLength < 4.6
      ? "Favor short, familiar words where they fit the source."
      : "Keep precise vocabulary appropriate to the subject.",
  ].join(" ");
}

const detailCues = [
  {
    id: "evidence",
    match:
      /\b(?:(?:studies|research|the data|surveys?) (?:show|shows|suggest|suggests|indicate|indicates|found)|according to (?:research|studies|the data))\b/i,
    skip: /https?:\/\/|\[\d+\]|\b(?:19|20)\d{2}\b|\bdoi:/i,
    question:
      "Which study, survey, or source supports this? Add a reference if you have one.",
  },
  {
    id: "time",
    match:
      /\b(?:recently|in the near future|at some point|in due course|for some time)\b/i,
    skip: /\d|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    question:
      "When did this happen, or when is it expected? Use a date or time period you can confirm.",
  },
  {
    id: "people",
    match:
      /\b(?:many|some|several|a number of) (?:people|users|customers|visitors|residents|participants|students|workers|readers|respondents)\b/i,
    skip: /\b\d+\b/,
    question:
      "Who exactly do you mean here? Name the group or add a count if you know it.",
  },
  {
    id: "outcome",
    match:
      /\b(?:makes? (?:a difference|everyday life easier)|improv(?:es?|ing) outcomes|(?:significant|substantial|meaningful) improvements?|measurable impact)\b/i,
    skip: /\b\d+\b/,
    question:
      "What specific change would someone notice? Add a real example or a measure you would use.",
  },
] as const;

export function suggestPersonalDetails(draft: string) {
  // Hide quoted and code content from the cues while keeping textarea offsets.
  const prose = draft.replace(
    /\x60{3}[\s\S]*?(?:\x60{3}|$)|\x60[^\x60\n]+\x60|"[^"\n]+"|“[^”\n]+”/g,
    (span) => span.replace(/[^\r\n]/g, " "),
  );
  const shown = new Set<string>();
  return tokenizeSentences(draft).flatMap(({ start, end, text }) => {
    const visible = prose.slice(start, end);
    const cue = detailCues.find(
      ({ id, match, skip }) =>
        !shown.has(id) && match.test(visible) && !skip.test(text),
    );
    if (!cue) return [];
    shown.add(cue.id);
    return [{ start, end, text, question: cue.question }];
  });
}
