import { analyzeStylometrics } from '../../src/lib/nlp/stylometrics';
import { cleanTextDeterministically } from '../../src/lib/humanizer/deterministic-cleaner';

// Initialize right-click context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'veritext-scan',
    title: 'Scan Selection with Veritext AI',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'veritext-clean',
    title: 'Quick De-AI Clean Selection',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !info.selectionText) return;

  const text = info.selectionText;

  if (info.menuItemId === 'veritext-scan') {
    const result = analyzeStylometrics(text);
    chrome.tabs.sendMessage(tab.id, {
      type: 'VERITEXT_SHOW_RESULT',
      payload: {
        mode: 'scan',
        aiScore: result.aiScore,
        isAi: result.isAi,
        confidence: result.confidence,
        language: result.language,
        obfuscationDetected: result.obfuscationReport.detected,
        selectedText: text,
      },
    });
  } else if (info.menuItemId === 'veritext-clean') {
    const cleaned = cleanTextDeterministically(text);
    const beforeRes = analyzeStylometrics(text);
    const afterRes = analyzeStylometrics(cleaned.cleanedText);

    chrome.tabs.sendMessage(tab.id, {
      type: 'VERITEXT_SHOW_RESULT',
      payload: {
        mode: 'clean',
        beforeScore: beforeRes.aiScore,
        afterScore: afterRes.aiScore,
        cleanedText: cleaned.cleanedText,
        selectedText: text,
      },
    });
  }
});
