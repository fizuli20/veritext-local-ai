import { describe, it, expect } from 'vitest';
import { GET as healthHandler } from '@/app/api/health/route';
import { POST as detectHandler } from '@/app/api/detect/route';
import { NextRequest } from 'next/server';

describe('Next.js Stateless API Routes', () => {
  it('GET /api/health returns 200 and valid zero-key manifest', async () => {
    const res = await healthHandler();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.zeroKeyMandate).toBe(true);
    expect(body.externalApiKeysRequired).toBe(false);
    expect(body.engines.detector).toBeDefined();
    expect(body.engines.humanizer).toBeDefined();
  });

  it('POST /api/detect returns 200 on valid text and sets cached: true on repeat', async () => {
    const text = `In today's fast-paced world, artificial intelligence plays a pivotal role in education. Furthermore, it is worth noting that distributed systems foster greater scalability and efficiency across enterprise teams.`;

    const req1 = new NextRequest('http://localhost:3000/api/detect', {
      method: 'POST',
      body: JSON.stringify({ text }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res1 = await detectHandler(req1);
    expect(res1.status).toBe(200);

    const body1 = await res1.json();
    expect(body1.aiScore).toBeGreaterThan(50);
    expect(body1.cached).toBe(false);
    expect(body1.sentences.length).toBeGreaterThan(0);
    expect(body1.signals.clicheLexicon).toBeGreaterThan(0.5);

    // Repeat request to test SHA-256 LRU cache
    const req2 = new NextRequest('http://localhost:3000/api/detect', {
      method: 'POST',
      body: JSON.stringify({ text }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res2 = await detectHandler(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.cached).toBe(true);
    expect(body2.aiScore).toBe(body1.aiScore);
  });

  it('POST /api/detect returns 400 on payload with < 10 characters', async () => {
    const req = new NextRequest('http://localhost:3000/api/detect', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hi' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await detectHandler(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Invalid request payload');
  });
});
