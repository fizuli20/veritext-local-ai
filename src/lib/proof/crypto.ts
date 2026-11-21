/**
 * Cryptographic "Proof-of-Human" Author Certification Engine
 * Uses standard Web Crypto API (ECDSA P-256 + SHA-256)
 * Runs 100% offline in browser and Node environments.
 */

export interface KeystrokeTelemetry {
  totalCompositionTimeSec: number;
  activeKeystrokeCount: number;
  pasteEventCount: number;
  pastedCharCount: number;
  totalCharCount: number;
  pasteRatio: number; // 0.0 to 1.0
  wordsPerMinute: number;
  keystrokeEntropy: number; // in bits
}

export interface RevisionCheckpoint {
  timestamp: string;
  charCount: number;
  hash: string;
}

export interface VeriTextProofPayload {
  version: '1.0';
  documentHash: string; // SHA-256 hex of final text
  metadata: {
    wordCount: number;
    charCount: number;
    timestamp: string;
    authorName?: string;
  };
  telemetry: KeystrokeTelemetry;
  revisionCheckpoints: RevisionCheckpoint[];
  publicKeyJwk: JsonWebKey;
}

export interface VeriTextProof extends VeriTextProofPayload {
  signatureBase64: string;
}

export interface VerificationResult {
  valid: boolean;
  documentIntegrityMatch: boolean;
  signatureValid: boolean;
  trustScore: number; // 0 to 100
  trustReasons: string[];
  tamperMessage?: string;
  proof: VeriTextProof;
}

const STORAGE_KEY_PAIR = 'veritext_proof_keypair_jwk_v1';

/**
 * Get the subtle crypto instance in browser or Node.
 */
function getSubtle(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in this environment.');
}

/**
 * Calculate SHA-256 hex string of a text.
 */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministically sorts object keys for canonical JSON serialization.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const parts = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(record[k])}`);
  return '{' + parts.join(',') + '}';
}

/**
 * Convert ArrayBuffer to Base64 string.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Convert Base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  let binary: string;
  if (typeof atob !== 'undefined') {
    binary = atob(base64);
  } else {
    binary = Buffer.from(base64, 'base64').toString('binary');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an ECDSA P-256 keypair for signing proofs.
 */
export async function generateAuthorKeyPair(): Promise<CryptoKeyPair> {
  const subtle = getSubtle();
  return await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );
}

/**
 * Load or generate the persistent author keypair from localStorage.
 */
export async function getOrCreateAuthorKeyPair(): Promise<{
  keyPair: CryptoKeyPair;
  publicKeyJwk: JsonWebKey;
}> {
  const subtle = getSubtle();

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PAIR);
      if (stored) {
        const { privateJwk, publicJwk } = JSON.parse(stored);
        const privateKey = await subtle.importKey(
          'jwk',
          privateJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign']
        );
        const publicKey = await subtle.importKey(
          'jwk',
          publicJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['verify']
        );
        return { keyPair: { privateKey, publicKey }, publicKeyJwk: publicJwk };
      }
    } catch {
      // If parsing fails, generate new
    }
  }

  const keyPair = await generateAuthorKeyPair();
  const publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_PAIR,
        JSON.stringify({ privateJwk, publicJwk })
      );
    } catch {
      // Storage quota or disabled
    }
  }

  return { keyPair, publicKeyJwk: publicJwk };
}

/**
 * Calculates Shannon entropy of inter-keystroke intervals.
 */
export function calculateIntervalEntropy(intervalsMs: number[]): number {
  if (intervalsMs.length < 2) return 0;

  // Bucket intervals into 100ms bins up to 2000ms
  const binCounts = new Map<number, number>();
  for (const interval of intervalsMs) {
    const clamped = Math.min(2000, Math.max(0, interval));
    const bin = Math.floor(clamped / 100);
    binCounts.set(bin, (binCounts.get(bin) || 0) + 1);
  }

  const total = intervalsMs.length;
  let entropy = 0;
  for (const count of binCounts.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  return parseFloat(entropy.toFixed(3));
}

/**
 * Creates and signs a VeriText Proof certificate.
 */
export async function createAndSignProof(params: {
  text: string;
  authorName?: string;
  telemetry: KeystrokeTelemetry;
  revisionCheckpoints: RevisionCheckpoint[];
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}): Promise<VeriTextProof> {
  const subtle = getSubtle();
  const documentHash = await sha256Hex(params.text);
  const words = params.text.trim().split(/\s+/).filter(Boolean).length;

  const payload: VeriTextProofPayload = {
    version: '1.0',
    documentHash,
    metadata: {
      wordCount: words,
      charCount: params.text.length,
      timestamp: new Date().toISOString(),
      authorName: params.authorName || 'Anonymous Verified Author',
    },
    telemetry: params.telemetry,
    revisionCheckpoints: params.revisionCheckpoints,
    publicKeyJwk: params.publicKeyJwk,
  };

  const canonicalPayload = canonicalJsonStringify(payload);
  const encoder = new TextEncoder();
  const signatureBuffer = await subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    params.privateKey,
    encoder.encode(canonicalPayload)
  );

  const signatureBase64 = bufferToBase64(signatureBuffer);

  return {
    ...payload,
    signatureBase64,
  };
}

/**
 * Computes the composite Authorship Trust Score (0-100) based on forensic telemetry.
 */
export function calculateTrustScore(
  telemetry: KeystrokeTelemetry,
  checkpoints: RevisionCheckpoint[]
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Paste Ratio (+30 max)
  if (telemetry.pasteRatio < 0.2) {
    score += 30;
    reasons.push('Low paste ratio (< 20%): Substantially authored via direct typing (+30 pts)');
  } else if (telemetry.pasteRatio < 0.5) {
    score += 15;
    reasons.push('Moderate paste ratio (< 50%): Mixed typing and editing (+15 pts)');
  } else {
    reasons.push('High paste ratio (≥ 50%): High proportion of inserted blocks (0 pts)');
  }

  // 2. Composition Time (+25 max)
  if (telemetry.totalCompositionTimeSec >= 180) {
    score += 25;
    reasons.push('Extended composition time (≥ 3 mins): Sustained manual writing session (+25 pts)');
  } else if (telemetry.totalCompositionTimeSec >= 60) {
    score += 15;
    reasons.push('Moderate composition time (≥ 1 min) (+15 pts)');
  } else if (telemetry.totalCompositionTimeSec >= 20) {
    score += 5;
    reasons.push('Brief composition time (≥ 20s) (+5 pts)');
  } else {
    reasons.push('Instant/Ultra-rapid composition (< 20s): Possible automated copy-paste (0 pts)');
  }

  // 3. Keystroke Entropy (+25 max)
  if (telemetry.keystrokeEntropy >= 2.5) {
    score += 25;
    reasons.push('High keystroke cadence variability (entropy ≥ 2.5 bits): Natural human typing rhythm (+25 pts)');
  } else if (telemetry.keystrokeEntropy >= 1.5) {
    score += 15;
    reasons.push('Moderate keystroke cadence variability (+15 pts)');
  } else if (telemetry.keystrokeEntropy > 0) {
    score += 5;
    reasons.push('Low keystroke variability (+5 pts)');
  } else {
    reasons.push('No keystroke intervals recorded (0 pts)');
  }

  // 4. Intermediate Checkpoints (+20 max)
  if (checkpoints.length >= 3) {
    score += 20;
    reasons.push('Continuous revision trail (≥ 3 draft snapshots): Proven evolution of document (+20 pts)');
  } else if (checkpoints.length >= 1) {
    score += 10;
    reasons.push('Basic revision trail recorded (+10 pts)');
  } else {
    reasons.push('No draft snapshots recorded (0 pts)');
  }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

/**
 * Verifies a VeriText Proof certificate against candidate document text.
 */
export async function verifyProof(
  proof: VeriTextProof,
  submittedText: string
): Promise<VerificationResult> {
  const subtle = getSubtle();

  // 1. Verify Document Integrity (SHA-256 match)
  const candidateHash = await sha256Hex(submittedText);
  const documentIntegrityMatch = candidateHash.toLowerCase() === proof.documentHash.toLowerCase();

  if (!documentIntegrityMatch) {
    return {
      valid: false,
      documentIntegrityMatch: false,
      signatureValid: false,
      trustScore: 0,
      trustReasons: [
        'Document content does NOT match the signed cryptographic hash.',
        `Signed Hash: ${proof.documentHash.slice(0, 16)}...`,
        `Submitted Hash: ${candidateHash.slice(0, 16)}...`,
      ],
      tamperMessage: 'TAMPER DETECTED: The submitted text differs from the certified document. Even a 1-character difference invalidates the proof.',
      proof,
    };
  }

  // 2. Re-create canonical payload without signatureBase64
  const { signatureBase64, ...payload } = proof;
  const canonicalPayload = canonicalJsonStringify(payload);

  // 3. Import public key and verify ECDSA signature
  let signatureValid = false;
  try {
    const publicKey = await subtle.importKey(
      'jwk',
      proof.publicKeyJwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['verify']
    );

    const signatureBytes = base64ToUint8Array(signatureBase64);
    const encoder = new TextEncoder();
    signatureValid = await subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signatureBytes.buffer as ArrayBuffer,
      encoder.encode(canonicalPayload)
    );
  } catch (err) {
    return {
      valid: false,
      documentIntegrityMatch: true,
      signatureValid: false,
      trustScore: 0,
      trustReasons: [`Signature verification failed: ${err instanceof Error ? err.message : String(err)}`],
      tamperMessage: 'INVALID SIGNATURE: Could not verify cryptographic proof signature.',
      proof,
    };
  }

  if (!signatureValid) {
    return {
      valid: false,
      documentIntegrityMatch: true,
      signatureValid: false,
      trustScore: 0,
      trustReasons: ['ECDSA P-256 cryptographic signature is invalid or corrupted.'],
      tamperMessage: 'TAMPER DETECTED: Cryptographic signature mismatch.',
      proof,
    };
  }

  // 4. Compute Trust Score
  const { score: trustScore, reasons: trustReasons } = calculateTrustScore(
    proof.telemetry,
    proof.revisionCheckpoints || []
  );

  return {
    valid: true,
    documentIntegrityMatch: true,
    signatureValid: true,
    trustScore,
    trustReasons,
    proof,
  };
}
