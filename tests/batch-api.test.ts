import { describe, it, expect } from 'vitest';
import { POST as batchDetectPost } from '../src/app/api/batch-detect/route';
import { GET as openApiGet } from '../src/app/api/openapi.json/route';
import { NextRequest } from 'next/server';

describe('Batch API & OpenAPI 3.1 Suite (V3 Apex)', () => {
  it('GET /api/openapi.json returns valid OpenAPI 3.1.0 schema with all endpoints documented', async () => {
    const res = await openApiGet();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.openapi).toBe('3.1.0');
    expect(json.info.title).toContain('Veritext');
    expect(json.paths['/api/health']).toBeDefined();
    expect(json.paths['/api/detect']).toBeDefined();
    expect(json.paths['/api/batch-detect']).toBeDefined();
  });

  it('POST /api/batch-detect evaluates multiple items and returns 200 with per-item scores', async () => {
    const payload = {
      items: [
        {
          id: 'item-1',
          text: "In today's fast-paced world, artificial intelligence plays a pivotal role in transforming modern education and digital pedagogy.",
          domain: 'general',
        },
        {
          id: 'item-2',
          text: 'We shut down Dublin Pod-B three weeks early, pocketing $140k in cooling leases. Half the racks moved to Frankfurt.',
          domain: 'general',
        },
      ],
    };

    const req = new NextRequest('http://localhost:3000/api/batch-detect', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await batchDetectPost(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.total).toBe(2);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].id).toBe('item-1');
    expect(data.items[0].aiScore).toBeGreaterThanOrEqual(70);
    expect(data.items[1].id).toBe('item-2');
  });

  it('POST /api/batch-detect returns 400 when items count exceeds 10', async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      id: `doc-${i}`,
      text: `Valid sentence number ${i} for testing payload restrictions in the batch detector.`,
    }));

    const req = new NextRequest('http://localhost:3000/api/batch-detect', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    const res = await batchDetectPost(req);
    expect(res.status).toBe(400);

    const err = await res.json();
    expect(err.error).toBe('Validation Error');
  });

  it('POST /api/batch-detect returns 400 when items array is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/batch-detect', {
      method: 'POST',
      body: JSON.stringify({ items: [] }),
    });

    const res = await batchDetectPost(req);
    expect(res.status).toBe(400);
  });
});
