import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { analyzeStylometrics } from '@/lib/nlp/stylometrics';
import { globalDetectionCache, computeHash } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DetectRequestSchema = z.object({
  text: z.string().min(10, 'Text must be at least 10 characters').max(100000, 'Text exceeds 100,000 characters limit'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = DetectRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { text } = parseResult.data;
    const hash = await computeHash(text);

    // Check LRU cache
    const cachedResult = globalDetectionCache.get(hash);
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        hash,
        engine: 'stylometric-instant-api',
      });
    }

    const startTime = performance.now();
    const result = analyzeStylometrics(text);
    const latencyMs = Math.round((performance.now() - startTime) * 10) / 10;

    // Store in cache
    globalDetectionCache.set(hash, result);

    return NextResponse.json({
      ...result,
      cached: false,
      hash,
      latencyMs,
      engine: 'stylometric-instant-api',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Failed to process text detection',
        message: error?.message || 'Unknown server error',
      },
      { status: 500 }
    );
  }
}
