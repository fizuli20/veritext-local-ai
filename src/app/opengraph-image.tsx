import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Veritext - Private Writing Editor & AI Text Signals';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #0f172a, #1e1b4b)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '48px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            V
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 'bold', margin: 0 }}>
            Veritext
          </h1>
        </div>
        <p
          style={{
            fontSize: '24px',
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          Private writing editor and uncertain AI text signals.
          Local models. No paid inference API key.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '32px',
            fontSize: '16px',
            fontFamily: 'monospace',
          }}
        >
          <span
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid #6366f1',
              color: '#a5b4fc',
            }}
          >
            Open Neural Model
          </span>
          <span
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              color: '#6ee7b7',
            }}
          >
            Local Writing AI
          </span>
          <span
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid #f59e0b',
              color: '#fcd34d',
            }}
          >
            Chrome Extension V3
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
