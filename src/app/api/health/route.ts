import { NextResponse } from "next/server";
import { DETECTOR_PROFILES } from "@/lib/detector/evidence";
import { WRITING_MODELS } from "@/lib/ml/writing-models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    product: "Veritext",
    version: "4.5.0",
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
        paragraphSignals:
          "First six eligible English paragraphs, minimum 80 words each. Uncalibrated model signals.",
      },
      humanizer: {
        engines: [
          "Browser WebLLM (WebGPU required)",
          "User-connected LM Studio/Ollama",
        ],
        automaticRuleFallback: false,
        semanticGuarantee: false,
        protectedSpans: true,
        rewriteDepths: ["polish", "rephrase"],
        documentImport: "Browser-local TXT, Markdown, DOCX and text-based PDF",
        sectionRetryLimit: 1,
        protectedSentenceRecoveryLimit: 4,
        browserModels: Object.values(WRITING_MODELS).map(({ id }) => id),
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
