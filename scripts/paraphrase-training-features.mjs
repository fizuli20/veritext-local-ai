import { createInterface } from "node:readline";
import { paraphraseFeatures } from "../src/lib/humanizer/paraphrase-features.ts";

for await (const line of createInterface({ input: process.stdin })) {
  const [source, target] = JSON.parse(line);
  process.stdout.write(JSON.stringify(paraphraseFeatures(source, target)) + "\n");
}
