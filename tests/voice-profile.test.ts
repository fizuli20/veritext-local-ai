import { describe, it, expect } from 'vitest';
import {
  extractVoiceFingerprint,
  generateVoicePromptDirective,
  computeVoiceDistance,
} from '../src/lib/nlp/voice-profile';

describe('Personal Voice Cloning ("Match My Style")', () => {
  const authorSample = `
    I broke the clamp at two in the morning. Didn't expect the cast iron to snap like chalk, but here we are.
    You can't weld pot metal with a cheap stick welder. I tried anyway. The sparks bounced off my boots,
    singed the doormat, and left a black smudge on the concrete. Was I tired? Absolutely. Did I stop? No way.
    By dawn, I had bolted two steel mending plates across the fracture, cranked down four grade-eight bolts,
    and called it a day. It's ugly as hell, but it holds thirty pounds without vibrating. That's good enough.
  `;

  it('accurately extracts burstiness, contraction rate, and readability', () => {
    const fp = extractVoiceFingerprint(authorSample);

    expect(fp.meanSentenceLength).toBeGreaterThan(5);
    expect(fp.meanSentenceLength).toBeLessThan(20);
    expect(fp.sentenceLengthCV).toBeGreaterThan(0.35); // High burstiness author
    expect(fp.contractionRate).toBeGreaterThan(1.0); // Uses didn't, can't, it's, that's
    expect(fp.fleschKincaidGrade).toBeLessThan(10); // Plain spoken narrative
    expect(fp.punctuationProfile.questionMarkRate).toBeGreaterThan(0);
  });

  it('generates compact, high-precision prompt constraints for WebLLM', () => {
    const fp = extractVoiceFingerprint(authorSample);
    const directive = generateVoicePromptDirective(fp);

    expect(directive).toContain('[AUTHOR VOICE PROFILE CONSTRAINTS]:');
    expect(directive).toContain('Target average sentence length');
    expect(directive).toContain('contractions');
  });

  it('measures small distance for similar writing and high distance for robotic AI prose', () => {
    const fp = extractVoiceFingerprint(authorSample);

    const similarCadence = `
      We lost the spare key in the gravel. Couldn't find it with the flashlight, so we walked home.
      It wasn't freezing, but the wind cut right through my denim jacket. We laughed about it later.
    `;

    const roboticAiProse = `
      In today's rapidly evolving technological landscape, organizations must delve into the multifaceted nature
      of strategic operational paradigms. Furthermore, ensuring seamless integration plays a pivotal role in fostering
      long-term sustainable excellence across diverse corporate environments. Ultimately, this approach serves as a testament.
    `;

    const distSimilar = computeVoiceDistance(similarCadence, fp);
    const distRobotic = computeVoiceDistance(roboticAiProse, fp);

    expect(distSimilar).toBeLessThan(distRobotic);
    expect(distSimilar).toBeLessThan(0.40);
    expect(distRobotic).toBeGreaterThan(0.50);
  });
});
