/**
 * Veritext Local AI - Client-Side Document Import & Export Engine
 * 100% Browser-Local Parsing & Generation (Zero Server Uploads, Complete Privacy)
 *
 * Supported Imports: .docx (mammoth), .pdf (pdfjs-dist), .md, .txt
 * Supported Exports: .docx (docx), .md, .txt, .html (Printable Forensic Audit Report), .json
 */

import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { ObfuscationReport } from '../nlp/sanitizer';
import { ConfidenceInterval } from '../nlp/calibration';

export interface ForensicReportData {
  documentTitle: string;
  timestamp: string;
  overallAiScore: number;
  confidenceInterval: ConfidenceInterval;
  isAi: boolean;
  domainProfile: string;
  wordCount: number;
  sentenceCount: number;
  burstinessCV: number;
  mtld: number;
  fleschKincaidGrade: number;
  gltrDistribution?: { top10: number; top100: number; top1000: number; beyond1000: number };
  obfuscationReport?: ObfuscationReport;
  sentences: Array<{
    index: number;
    text: string;
    score: number;
    reasons: string[];
  }>;
}

/**
 * Parses raw file bytes into plain text on the client.
 */
export async function parseDocumentFile(file: File): Promise<{ text: string; fileName: string; format: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'txt' || extension === 'md') {
    const text = await file.text();
    return { text, fileName: file.name, format: extension };
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value.trim(), fileName: file.name, format: 'docx' };
  }

  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    // Dynamic import of pdfjs-dist to optimize bundle splitting
    const pdfjs = await import('pdfjs-dist');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((item: any) => item.str || '');
      fullText += pageStrings.join(' ') + '\n\n';
    }

    return { text: fullText.trim(), fileName: file.name, format: 'pdf' };
  }

  // Fallback to text reader
  const text = await file.text();
  return { text, fileName: file.name, format: extension || 'text' };
}

/**
 * Generates and triggers browser download of a clean .docx file.
 */
export async function exportToDocx(text: string, filename = 'veritext-humanized.docx'): Promise<Blob> {
  const paragraphs = text
    .split(/\n\s*\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => {
      return new Paragraph({
        children: [
          new TextRun({
            text: p.trim(),
            size: 24, // 12pt
            font: 'Calibri',
          }),
        ],
        spacing: {
          after: 200, // 10pt space after
          line: 276, // 1.15 line spacing
        },
      });
    });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'Veritext Humanized Document',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          ...paragraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Generates a self-contained, printable HTML Forensic Audit Report.
 */
export function generateForensicHtmlReport(data: ForensicReportData): string {
  const aiBadgeClass =
    data.overallAiScore >= 75
      ? 'background: #fee2e2; color: #991b1b; border: 1px solid #f87171;'
      : data.overallAiScore >= 45
        ? 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;'
        : 'background: #dcfce7; color: #166534; border: 1px solid #86efac;';

  const rows = data.sentences
    .map((s) => {
      const rowStyle =
        s.score >= 70
          ? 'background: #fef2f2;'
          : s.score >= 40
            ? 'background: #fffbeb;'
            : 'background: #ffffff;';
      const scoreBadge =
        s.score >= 70
          ? 'color: #dc2626; font-weight: bold;'
          : s.score >= 40
            ? 'color: #d97706; font-weight: bold;'
            : 'color: #16a34a;';

      const reasonsList = s.reasons.length > 0 ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${s.reasons.join(' • ')}</div>` : '';

      return `<tr style="${rowStyle} border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px; font-family: monospace; font-size: 12px; color: #6b7280; text-align: center;">${s.index + 1}</td>
        <td style="padding: 10px; font-size: 13px; line-height: 1.5;">${escapeHtml(s.text)}${reasonsList}</td>
        <td style="padding: 10px; font-family: monospace; font-size: 13px; text-align: center; ${scoreBadge}">${s.score}%</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Veritext Forensic Audit — ${escapeHtml(data.documentTitle)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px auto; max-width: 860px; color: #1f2937; line-height: 1.5; background: #fafafa; }
    .report-card { background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
    .brand { font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
    .badge { padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; text-transform: uppercase; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .stat-box { background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #f3f4f6; text-align: center; }
    .stat-val { font-size: 24px; font-weight: 800; font-family: monospace; color: #111827; }
    .stat-lbl { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-top: 4px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th { background: #f9fafb; padding: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; text-align: left; border-bottom: 2px solid #e5e7eb; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; font-family: monospace; }
    @media print { body { background: #fff; margin: 0; } .report-card { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      <div>
        <div class="brand">VERITEXT LOCAL AI</div>
        <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">Academic-Grade Forensic Authorship & Detection Audit</div>
        <div style="font-size: 11px; color: #9ca3af; margin-top: 4px; font-family: monospace;">Audit Timestamp: ${data.timestamp} • Profile: ${data.domainProfile}</div>
      </div>
      <div>
        <span class="badge" style="${aiBadgeClass}">AI Probability: ${data.overallAiScore}% (±${data.confidenceInterval.margin}%)</span>
      </div>
    </div>

    <div class="grid">
      <div class="stat-box">
        <div class="stat-val">${data.wordCount}</div>
        <div class="stat-lbl">Total Words</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${data.sentenceCount}</div>
        <div class="stat-lbl">Sentences</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${data.burstinessCV}</div>
        <div class="stat-lbl">Burstiness (CV)</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${data.mtld}</div>
        <div class="stat-lbl">MTLD Diversity</div>
      </div>
    </div>

    ${
      data.obfuscationReport && data.obfuscationReport.detected
        ? `<div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #92400e;">
            <strong>⚠️ Adversarial Obfuscation Detected & Normalized:</strong> Found ${data.obfuscationReport.zeroWidthCount} zero-width / invisible characters and ${data.obfuscationReport.homoglyphCount} confusable homoglyphs.
          </div>`
        : ''
    }

    <h3 style="font-size: 15px; font-weight: 700; margin-top: 24px; color: #111827;">Sentence Forensic Breakdown</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th>Analyzed Passage Sentence</th>
          <th style="width: 90px; text-align: center;">AI Risk</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="footer">
      100% Client-Side Privacy Verification. Computed locally in browser RAM without external token egress. Veritext Local AI v2.0.0.
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
