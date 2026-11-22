import { NextResponse } from "next/server";
import { DETECTOR_PROFILES } from "@/lib/detector/evidence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    product: "Veritext",
    version: "4.3.0",
    zeroKeyMandate: true,
    externalApiKeysRequired: false,
    engines: {
      detector: {
        defaultProfile: "detailed",
        profiles: DETECTOR_PROFILES,
        model: DETECTOR_PROFILES.detailed.model,
        revision: DETECTOR_PROFILES.detailed.revision,
        backend: "browser WASM; detailed INT8 weights / FP32 math, light Q8",
        readiness:
          "Client must load model; server health does not prove client inference works.",
        calibration: "Provisional HC3 reference; see /benchmarks",
      },
      humanizer: {
        engines: [
          "Browser WebLLM (WebGPU required)",
          "User-connected LM Studio/Ollama",
        ],
        automaticRuleFallback: false,
        semanticGuarantee: false,
        protectedSpans: true,
        sectionRetryLimit: 1,
        protectedSentenceRecoveryLimit: 4,
        browserModels: [
          "Llama-3.2-1B-Instruct-q4f16_1-MLC",
          "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
          "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        ],
      },
      privacy: {
        browserWorkspaceTextUploadedToVercel: false,
        localServerReceivesRewriteText: true,
        legacyApiReceivesSubmittedText: true,
        modelDownloads: "Hugging Face and MLC model hosts",
      },
    },
    timestamp: new Date().toISOString(),
  });
}
