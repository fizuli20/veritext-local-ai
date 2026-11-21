// Shadow-DOM isolated floating forensic card
let container: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'VERITEXT_SHOW_RESULT') return;

  const { mode, aiScore, isAi, confidence, language, obfuscationDetected, beforeScore, afterScore, cleanedText } = msg.payload;

  if (!container) {
    container = document.createElement('div');
    container.id = 'veritext-extension-root';
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.zIndex = '2147483647';
    document.body.appendChild(container);
    shadow = container.attachShadow({ mode: 'open' });
  }

  if (!shadow) return;

  let contentHtml = '';
  if (mode === 'scan') {
    const badgeColor = aiScore >= 70 ? '#e11d48' : aiScore >= 35 ? '#d97706' : '#059669';
    const badgeBg = aiScore >= 70 ? '#ffe4e6' : aiScore >= 35 ? '#fef3c7' : '#d1fae5';
    const verdict = aiScore >= 70 ? 'Likely AI-Generated' : aiScore >= 35 ? 'Mixed / Edited' : 'Human-Written';

    contentHtml = `
      <div class="header">
        <span class="title">Veritext Local AI</span>
        <button id="close-btn" class="close">&times;</button>
      </div>
      <div class="score-card">
        <span class="score-badge" style="background: ${badgeBg}; color: ${badgeColor};">
          ${aiScore}% AI Risk
        </span>
        <div class="verdict">${verdict}</div>
      </div>
      <div class="details">
        <div><strong>Language:</strong> ${language?.name || 'English'}</div>
        <div><strong>Confidence:</strong> ${confidence}</div>
        ${obfuscationDetected ? '<div class="alert">⚠️ Adversarial Obfuscation Detected & Normalized</div>' : ''}
      </div>
    `;
  } else {
    contentHtml = `
      <div class="header">
        <span class="title">Veritext De-AI Cleaner</span>
        <button id="close-btn" class="close">&times;</button>
      </div>
      <div class="score-card">
        <div>Before: <strong>${beforeScore}%</strong> &rarr; After: <strong style="color: #059669;">${afterScore}%</strong></div>
      </div>
      <div class="clean-output">${cleanedText}</div>
      <button id="copy-btn" class="action-btn">Copy Cleaned Text</button>
    `;
  }

  shadow.innerHTML = `
    <style>
      .card {
        width: 320px;
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        padding: 14px;
        box-sizing: border-box;
      }
      .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 10px; }
      .title { font-weight: 700; color: #4338ca; }
      .close { background: none; border: none; font-size: 16px; cursor: pointer; color: #94a3b8; }
      .close:hover { color: #0f172a; }
      .score-card { text-align: center; margin-bottom: 10px; }
      .score-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 14px; font-family: monospace; }
      .verdict { font-size: 11px; font-weight: 600; margin-top: 4px; color: #475569; }
      .details { font-size: 11px; line-height: 1.6; color: #64748b; }
      .alert { color: #b91c1c; font-weight: bold; margin-top: 4px; }
      .clean-output { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; max-height: 120px; overflow-y: auto; margin: 8px 0; font-size: 11px; line-height: 1.4; }
      .action-btn { width: 100%; padding: 6px; border-radius: 6px; border: none; background: #0f172a; color: #fff; font-weight: 600; cursor: pointer; font-size: 11px; }
      .action-btn:hover { background: #1e293b; }
    </style>
    <div class="card">
      ${contentHtml}
    </div>
  `;

  shadow.getElementById('close-btn')?.addEventListener('click', () => {
    container?.remove();
    container = null;
    shadow = null;
  });

  shadow.getElementById('copy-btn')?.addEventListener('click', () => {
    if (cleanedText) {
      navigator.clipboard.writeText(cleanedText);
      const btn = shadow?.getElementById('copy-btn');
      if (btn) btn.textContent = 'Copied!';
      setTimeout(() => {
        if (btn) btn.textContent = 'Copy Cleaned Text';
      }, 2000);
    }
  });
});
