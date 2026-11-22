export const WRITING_MODELS = {
  fast: {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Light · Llama 1B",
    description:
      "About 0.7–0.9 GB download. Small edits on lower-memory devices.",
    memoryMB: 880,
  },
  balanced: {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Balanced · Qwen 1.5B",
    description:
      "About 1 GB download and 1.6 GB working GPU memory. Try for more substantial edits.",
    memoryMB: 1630,
  },
  qwen3b: {
    id: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    label: "Larger · Qwen 3B",
    description:
      "About 1.8 GB download and 2.5 GB working GPU memory. Try it for more detailed rewrites on a device with sufficient memory.",
    memoryMB: 2505,
  },
  quality: {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Larger · Llama 3B",
    description:
      "About 1.8–2.2 GB download and 2.3 GB working GPU memory. Requires more memory.",
    memoryMB: 2264,
  },
  advanced: {
    id: "Qwen3.5-4B-q4f16_1-MLC",
    label: "Advanced · Qwen3.5 4B",
    description:
      "About 2.4 GB download and 3.9 GB working GPU memory. Choose this on a device with enough memory for the larger writing model.",
    memoryMB: 3868,
  },
} as const;
export type WritingModelTier = keyof typeof WRITING_MODELS;
export function resolveWritingModel<T extends { model_id: string }>(
  records: T[],
  tier: WritingModelTier,
): T {
  const record = records.find(
    (item) => item.model_id === WRITING_MODELS[tier].id,
  );
  if (!record)
    throw new Error(
      "This writing model is unavailable in the installed runtime. Choose another model.",
    );
  return record;
}
