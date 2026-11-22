import type { RewriteDepth } from "./humanizer/rewrite-review";
import type { DetectorTier } from "./detector/evidence";

export const WORKSPACE_KEY = "veritext.workspace.v1";
export const WORKSPACE_ENABLED_KEY = "veritext.workspace.remember";
export const REWRITE_MODES = [
  "standard",
  "academic",
  "casual",
  "professional",
  "concise",
  "expand",
] as const;
export type RewriteMode = (typeof REWRITE_MODES)[number];

export interface WorkspaceSnapshot {
  version: 1;
  rewriteInput: string;
  detectorInput: string;
  output: string;
  source: string;
  lockedTerms: string;
  styleNote: string;
  mode: RewriteMode;
  outputMode: RewriteMode;
  depth: RewriteDepth;
  outputDepth: RewriteDepth;
  detectorTier: DetectorTier;
  tab: "humanizer" | "detector";
}

export function readWorkspace(raw: string | null): WorkspaceSnapshot | null {
  if (!raw || raw.length > 2_000_000) return null;
  try {
    const data = JSON.parse(raw) as Partial<WorkspaceSnapshot> | null;
    if (!data || data.version !== 1) return null;
    const {
      rewriteInput,
      detectorInput,
      output,
      source,
      lockedTerms,
      styleNote,
    } = data;
    if (
      typeof rewriteInput !== "string" ||
      typeof detectorInput !== "string" ||
      typeof output !== "string" ||
      typeof source !== "string" ||
      typeof lockedTerms !== "string" ||
      typeof styleNote !== "string"
    )
      return null;
    return {
      version: 1,
      rewriteInput,
      detectorInput,
      output,
      source,
      lockedTerms: lockedTerms.slice(0, 1000),
      styleNote: styleNote.slice(0, 300),
      mode:
        data.mode && REWRITE_MODES.includes(data.mode) ? data.mode : "standard",
      outputMode:
        data.outputMode && REWRITE_MODES.includes(data.outputMode)
          ? data.outputMode
          : "standard",
      depth: data.depth === "polish" ? "polish" : "rephrase",
      outputDepth: data.outputDepth === "polish" ? "polish" : "rephrase",
      detectorTier: data.detectorTier === "light" ? "light" : "detailed",
      tab: data.tab === "detector" ? "detector" : "humanizer",
    };
  } catch {
    return null;
  }
}
