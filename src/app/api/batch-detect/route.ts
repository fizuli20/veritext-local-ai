import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeStylometrics, StylometricResult } from '@/lib/nlp/stylometrics';
import { DomainProfile } from '@/lib/nlp/calibration';

export const runtime = 'nodejs';

const batchItemSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(5, 'Text must be at least 5 characters').max(20000, 'Text exceeds 20,000 characters'),
  domain: z.enum(['general', 'academic', 'technical', 'creative', 'esl-fair']).optional().default('general'),
});

const batchRequestSchema = z.object({
  items: z.array(batchItemSchema).min(1, 'At least 1 item is required').max(10, 'Maximum 10 items per batch request'),
});

// In-memory SHA-256 cache
const batchCache = new Map<string, { result: StylometricResult; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

async function hashKey(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = batchRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { items } = parseResult.data;
    const now = Date.now();

    const responses = await Promise.all(
      items.map(async (item, idx) => {
        const itemId = item.id ?? `item-${idx + 1}`;
        const start = performance.now();
        const key = await hashKey(`${item.domain}:${item.text}`);

        const cached = batchCache.get(key);
        if (cached && now - cached.timestamp < CACHE_TTL_MS) {
          return {
            id: itemId,
            aiScore: cached.result.aiScore,
            isAi: cached.result.isAi,
            confidence: cached.result.confidence,
            domain: item.domain,
            language: cached.result.language,
            signals: cached.result.signals,
            obfuscationReport: cached.result.obfuscationReport,
            metrics: cached.result.metrics,
            cached: true,
            latencyMs: Math.round((performance.now() - start) * 10) / 10,
          };
        }

        const res = analyzeStylometrics(item.text, item.domain as DomainProfile);
        batchCache.set(key, { result: res, timestamp: now });

        return {
          id: itemId,
          aiScore: res.aiScore,
          isAi: res.isAi,
          confidence: res.confidence,
          domain: item.domain,
          language: res.language,
          signals: res.signals,
          obfuscationReport: res.obfuscationReport,
          metrics: res.metrics,
          cached: false,
          latencyMs: Math.round((performance.now() - start) * 10) / 10,
        };
      })
    );

    return NextResponse.json(
      {
        total: responses.length,
        items: responses,
        mandate: '100% Free, Zero-Token, Zero-API-Key Stateless API',
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Veritext-Mode': 'zero-token-stateless-batch',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
