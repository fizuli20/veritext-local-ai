import { analyzeStylometrics } from '../../src/lib/nlp/stylometrics';
import { cleanTextDeterministically } from '../../src/lib/humanizer/deterministic-cleaner';

const inputEl = document.getElementById('input-text') as HTMLTextAreaElement;
const scanBtn = document.getElementById('scan-btn') as HTMLButtonElement;
const cleanBtn = document.getElementById('clean-btn') as HTMLButtonElement;
const resultBox = document.getElementById('result-box') as HTMLDivElement;
const alertBox = document.getElementById('alert-box') as HTMLDivElement;
const scoreVal = document.getElementById('score-val') as HTMLSpanElement;
const verdictLabel = document.getElementById('verdict-label') as HTMLSpanElement;
const telemetry = document.getElementById('telemetry') as HTMLDivElement;
const cleanOutput = document.getElementById('clean-output') as HTMLDivElement;

scanBtn?.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if (!text) return;

  const res = analyzeStylometrics(text);

  resultBox.style.display = 'block';
  cleanOutput.style.display = 'none';

  scoreVal.textContent = `${res.aiScore}%`;
  if (res.aiScore >= 70) {
    scoreVal.style.color = '#e11d48';
    verdictLabel.textContent = 'Likely AI-Generated';
  } else if (res.aiScore >= 35) {
    scoreVal.style.color = '#d97706';
    verdictLabel.textContent = 'Mixed / Edited';
  } else {
    scoreVal.style.color = '#059669';
    verdictLabel.textContent = 'Human-Written';
  }

  if (res.obfuscationReport.detected) {
    alertBox.style.display = 'block';
  } else {
    alertBox.style.display = 'none';
  }

  telemetry.textContent = `Language: ${res.language.name} | ${res.metrics.wordCount} words | ${res.confidence} confidence`;
});

cleanBtn?.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if (!text) return;

  const beforeRes = analyzeStylometrics(text);
  const cleaned = cleanTextDeterministically(text);
  const afterRes = analyzeStylometrics(cleaned.cleanedText);

  resultBox.style.display = 'block';
  cleanOutput.style.display = 'block';
  cleanOutput.textContent = cleaned.cleanedText;

  scoreVal.textContent = `${afterRes.aiScore}%`;
  scoreVal.style.color = '#059669';
  verdictLabel.textContent = `Cleaned (Drop: -${beforeRes.aiScore - afterRes.aiScore}%)`;

  telemetry.textContent = `Before: ${beforeRes.aiScore}% → After: ${afterRes.aiScore}% | ${cleaned.changesCount} revisions`;
});
