import { describe, it, expect } from 'vitest';
import { exportToDocx, generateForensicHtmlReport, ForensicReportData } from '../src/lib/io/documents';

describe('Client Document Import & Export Engine', () => {
  it('generates a valid binary .docx blob without errors', async () => {
    const sampleText = 'This is paragraph one.\n\nThis is paragraph two with quantitative data: 42% of nodes.';
    const blob = await exportToDocx(sampleText, 'test.docx');

    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain('wordprocessingml.document');
  });

  it('generates a complete, printable HTML forensic audit report', () => {
    const reportData: ForensicReportData = {
      documentTitle: 'Research Draft Investigation',
      timestamp: '2026-11-21 14:00:00 UTC',
      overallAiScore: 84,
      confidenceInterval: {
        score: 84,
        margin: 5,
        lower: 79,
        upper: 89,
        reliability: 'high',
        mixedOrEdited: false,
      },
      isAi: true,
      domainProfile: 'Academic / Research',
      wordCount: 142,
      sentenceCount: 7,
      burstinessCV: 0.22,
      mtld: 120,
      fleschKincaidGrade: 14.2,
      sentences: [
        {
          index: 0,
          text: 'In today\'s rapidly evolving landscape, we must delve into these aspects.',
          score: 88,
          reasons: ['Contains AI cliché: "delve into"'],
        },
      ],
    };

    const html = generateForensicHtmlReport(reportData);

    expect(html).toContain('VERITEXT LOCAL AI');
    expect(html).toContain('AI Probability: 84% (±5%)');
    expect(html).toContain('Research Draft Investigation');
    expect(html).toContain('delve into');
    expect(html).toContain('Sentence Forensic Breakdown');
  });
});
