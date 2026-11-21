import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Dynamically import compiled or source modules
async function main() {
  console.log('⚡ Running Real-World Out-of-Distribution Calibration Benchmark...');

  const fixturePath = path.join(projectRoot, 'tests/fixtures/real-world-holdout.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  // Import stylometrics and metrics
  const { analyzeStylometrics } = await import('../src/lib/nlp/stylometrics.ts');
  const { computeRocCurve } = await import('../src/lib/nlp/metrics.ts');

  const labels = [];
  const scores = [];
  const domainStats = {};

  for (const item of fixture.items) {
    const domain = item.domain || 'general';
    const domainSetting = domain === 'academic' ? 'academic' : 'general';
    const res = analyzeStylometrics(item.text, domainSetting);

    const isActualAi = item.isAi ? 1 : 0;
    labels.push(isActualAi);
    scores.push(res.aiScore);

    if (!domainStats[domain]) {
      domainStats[domain] = { total: 0, falsePositives: 0, falseNegatives: 0, truePositives: 0, trueNegatives: 0 };
    }
    const stat = domainStats[domain];
    stat.total++;

    const predictedAi = res.aiScore >= 50;
    if (item.isAi) {
      if (predictedAi) stat.truePositives++;
      else stat.falseNegatives++;
    } else {
      if (predictedAi) stat.falsePositives++;
      else stat.trueNegatives++;
    }
  }

  const roc = computeRocCurve(labels, scores);

  const domainResults = Object.entries(domainStats).map(([dom, s]) => {
    const humanCount = s.trueNegatives + s.falsePositives;
    const fpRate = humanCount > 0 ? Math.round((s.falsePositives / humanCount) * 1000) / 10 : 0;
    return {
      domain: dom,
      samples: s.total,
      falsePositiveRate: fpRate,
      accuracy: Math.round(((s.truePositives + s.trueNegatives) / s.total) * 1000) / 10,
    };
  });

  const benchmarkReport = {
    generatedAt: new Date().toISOString(),
    dataset: fixture.dataset,
    totalSamples: fixture.items.length,
    metrics: {
      auc: roc.auc,
      tprAt1Fpr: roc.tprAt1Fpr,
      tprAt5Fpr: roc.tprAt5Fpr,
      ece: roc.ece,
    },
    rocCurve: roc.rocPoints,
    calibrationCurve: roc.calibrationBins,
    domainResults,
  };

  const outputDir = path.join(projectRoot, 'src/data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'benchmark-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(benchmarkReport, null, 2), 'utf-8');

  console.log(`✅ Benchmark complete!`);
  console.log(`   - ROC-AUC: ${roc.auc}`);
  console.log(`   - TPR @ 5% FPR: ${roc.tprAt5Fpr * 100}%`);
  console.log(`   - ECE: ${roc.ece}`);
  console.log(`   - Domain Results:`, domainResults);
  console.log(`   - Saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
