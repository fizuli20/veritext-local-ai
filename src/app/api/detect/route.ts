import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeStylometrics } from "@/lib/nlp/stylometrics";
import { globalDetectionCache, computeHash } from "@/lib/cache";
import { DomainProfile } from "@/lib/nlp/calibration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DetectRequestSchema = z.object({
  text: z
    .string()
    .min(10, "Text must be at least 10 characters")
    .max(100000, "Text exceeds 100,000 characters limit"),
  domain: z
    .enum(["general", "academic", "technical", "creative", "esl-fair"])
    .optional()
    .default("general"),
});

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parseResult = DetectRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { text, domain } = parseResult.data;
    const hash = await computeHash(`${domain}:${text}`);

    // Check LRU cache
    const cachedResult: any = globalDetectionCache.get(hash);
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        isAi: null,
        confidence: "low",
        calibratedProbability: null,
        scoreMeaning:
          "Uncalibrated legacy style index; not neural AI detection or proof of authorship.",
        cached: true,
        hash,
        engine: "stylometric-instant-api",
        verdict: "No authorship conclusion",
      });
    }

    const startTime = performance.now();
    const result = analyzeStylometrics(text, domain as DomainProfile);
    const latencyMs = Math.round((performance.now() - startTime) * 10) / 10;

    // Store in cache
    globalDetectionCache.set(hash, result);

    return NextResponse.json({
      ...result,
      isAi: null,
      confidence: "low",
      calibratedProbability: null,
      scoreMeaning:
        "Uncalibrated legacy style index; not neural AI detection or proof of authorship.",
      cached: false,
      hash,
      latencyMs,
      engine: "stylometric-instant-api",
      verdict: "No authorship conclusion",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to process text detection",
        message:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}
