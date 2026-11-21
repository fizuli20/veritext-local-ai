import { NextResponse } from "next/server";
import { DETECTOR_MODEL, DETECTOR_REVISION } from "@/lib/detector/evidence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    product: "Veritext",
    version: "4.1.0",
    zeroKeyMandate: true,
    externalApiKeysRequired: false,
    engines: {
      detector: {
        model: DETECTOR_MODEL,
        revision: DETECTOR_REVISION,
        backend: "browser WASM Q8",
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
