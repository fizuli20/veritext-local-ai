import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://veritext-local-ai.vercel.app'),
  title: 'Veritext Local AI — Zero-Token AI Detector & Humanizer',
  description:
    '100% Free, Zero-API-Key Browser-Local AI Detection & Humanization powered by Pure TypeScript Stylometrics, ONNX RoBERTa (WebGPU/WASM), and WebLLM.',
  keywords: [
    'AI detector',
    'AI humanizer',
    'zero token',
    'zero api key',
    'webgpu',
    'wasm',
    'stylometrics',
    'client side AI',
  ],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
