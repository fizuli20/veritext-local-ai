// Compatibility entry point. The previous synthetic 5+5 score gate was not
// an authentic-human benchmark and its score formula did not run in production.
// Run real pinned-model inference and held-out comparisons instead.
console.log("Running the measured Detailed detector protocol; no synthetic score gate.");
await import("./verify-detailed-detector.mjs");
