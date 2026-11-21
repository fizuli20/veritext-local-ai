import { describe, it, expect } from 'vitest';
import {
  generateAuthorKeyPair,
  sha256Hex,
  canonicalJsonStringify,
  calculateIntervalEntropy,
  createAndSignProof,
  verifyProof,
  calculateTrustScore,
  KeystrokeTelemetry,
  RevisionCheckpoint,
} from '../src/lib/proof/crypto';

describe('Cryptographic Proof-of-Human Engine', () => {
  it('computes deterministic SHA-256 hex and catches 1-char differences', async () => {
    const textA = 'The quick brown fox jumps over the lazy dog.';
    const textB = 'The quick brown fox jumps over the lazy dog!'; // 1-char diff
    const hashA = await sha256Hex(textA);
    const hashB = await sha256Hex(textB);

    expect(hashA).toHaveLength(64);
    expect(hashB).toHaveLength(64);
    expect(hashA).not.toBe(hashB);
  });

  it('serializes objects canonically regardless of key insertion order', () => {
    const objA = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const objB = { a: 1, c: { x: 10, y: 20 }, b: 2 };
    expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB));
  });

  it('calculates keystroke interval entropy', () => {
    // Zero/flat intervals
    expect(calculateIntervalEntropy([])).toBe(0);
    expect(calculateIntervalEntropy([100])).toBe(0);

    // Highly varied intervals
    const variedIntervals = [120, 240, 480, 150, 800, 320, 110, 50, 950, 210, 180, 600];
    const entropy = calculateIntervalEntropy(variedIntervals);
    expect(entropy).toBeGreaterThan(2.0);
  });

  it('calculates expected authorship trust scores', () => {
    const highTrustTelemetry: KeystrokeTelemetry = {
      totalCompositionTimeSec: 240,
      activeKeystrokeCount: 500,
      pasteEventCount: 0,
      pastedCharCount: 0,
      totalCharCount: 500,
      pasteRatio: 0.0,
      wordsPerMinute: 45,
      keystrokeEntropy: 2.8,
    };
    const checkpoints: RevisionCheckpoint[] = [
      { timestamp: '2026-11-21T18:00:00Z', charCount: 150, hash: 'abc1' },
      { timestamp: '2026-11-21T18:01:00Z', charCount: 320, hash: 'abc2' },
      { timestamp: '2026-11-21T18:02:00Z', charCount: 500, hash: 'abc3' },
    ];

    const result = calculateTrustScore(highTrustTelemetry, checkpoints);
    expect(result.score).toBe(100); // 30 + 25 + 25 + 20
    expect(result.reasons.length).toBe(4);
  });

  it('signs and verifies a valid document with ECDSA P-256', async () => {
    const keyPair = await generateAuthorKeyPair();
    const subtle = globalThis.crypto.subtle;
    const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);

    const text = 'This is an authentic human draft written from scratch with genuine rhythm.';
    const telemetry: KeystrokeTelemetry = {
      totalCompositionTimeSec: 120,
      activeKeystrokeCount: 75,
      pasteEventCount: 1,
      pastedCharCount: 5,
      totalCharCount: 75,
      pasteRatio: 0.067,
      wordsPerMinute: 40,
      keystrokeEntropy: 2.6,
    };
    const checkpoints: RevisionCheckpoint[] = [
      { timestamp: new Date().toISOString(), charCount: 40, hash: 'hash1' },
    ];

    const proof = await createAndSignProof({
      text,
      authorName: 'Alice Developer',
      telemetry,
      revisionCheckpoints: checkpoints,
      privateKey: keyPair.privateKey,
      publicKeyJwk,
    });

    expect(proof.signatureBase64).toBeDefined();
    expect(proof.documentHash).toBe(await sha256Hex(text));

    // Verify valid text
    const verifyResult = await verifyProof(proof, text);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.documentIntegrityMatch).toBe(true);
    expect(verifyResult.signatureValid).toBe(true);
    expect(verifyResult.trustScore).toBeGreaterThanOrEqual(60);
  });

  it('rejects verification with TAMPER DETECTED when text is modified by even 1 character', async () => {
    const keyPair = await generateAuthorKeyPair();
    const subtle = globalThis.crypto.subtle;
    const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);

    const originalText = 'Original certified human composition.';
    const tamperedText = 'Original certified human composition!'; // 1-character modification

    const proof = await createAndSignProof({
      text: originalText,
      authorName: 'Bob Scholar',
      telemetry: {
        totalCompositionTimeSec: 200,
        activeKeystrokeCount: 100,
        pasteEventCount: 0,
        pastedCharCount: 0,
        totalCharCount: 100,
        pasteRatio: 0,
        wordsPerMinute: 50,
        keystrokeEntropy: 2.7,
      },
      revisionCheckpoints: [],
      privateKey: keyPair.privateKey,
      publicKeyJwk,
    });

    const verifyResult = await verifyProof(proof, tamperedText);
    expect(verifyResult.valid).toBe(false);
    expect(verifyResult.documentIntegrityMatch).toBe(false);
    expect(verifyResult.tamperMessage).toContain('TAMPER DETECTED');
  });
});
