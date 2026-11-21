import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Veritext Local AI API',
      version: '3.0.0',
      description:
        'Stateless, 100% Zero-Token, Zero-API-Key AI Stylometric Detection and Forensic Analysis API. All endpoints are publicly accessible without authentication.',
      contact: {
        name: 'fizuli20',
        url: 'https://github.com/fizuli20/veritext-local-ai',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://veritext-local-ai.vercel.app',
        description: 'Production Server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
    paths: {
      '/api/health': {
        get: {
          summary: 'Health & In-Browser Model Manifest',
          description:
            'Returns runtime engine status, supported Web Worker models, zero-key mandate confirmation, and memory scheduler configurations.',
          operationId: 'getHealth',
          responses: {
            '200': {
              description: 'System healthy and operational',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      product: { type: 'string', example: 'Veritext Local AI' },
                      version: { type: 'string', example: '3.0.0' },
                      zeroKeyMandate: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/detect': {
        post: {
          summary: 'Single Text Forensic Detection',
          description:
            'Analyzes prose using pure TypeScript 6-signal stylometrics and returns probability scores, adversarial obfuscation report, language info, and sentence breakdown.',
          operationId: 'detectText',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: {
                      type: 'string',
                      description: 'Prose to evaluate (minimum 10 characters)',
                      example: 'In today\'s fast-paced world, artificial intelligence plays a pivotal role in education.',
                    },
                    domain: {
                      type: 'string',
                      enum: ['general', 'academic', 'technical', 'creative', 'esl-fair'],
                      default: 'general',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful forensic evaluation',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      aiScore: { type: 'integer', minimum: 0, maximum: 100 },
                      isAi: { type: 'boolean' },
                      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                      language: {
                        type: 'object',
                        properties: {
                          code: { type: 'string' },
                          name: { type: 'string' },
                          englishOptimized: { type: 'boolean' },
                        },
                      },
                      obfuscationReport: {
                        type: 'object',
                        properties: {
                          detected: { type: 'boolean' },
                          zeroWidthCount: { type: 'integer' },
                          homoglyphCount: { type: 'integer' },
                        },
                      },
                      signals: { type: 'object' },
                      cached: { type: 'boolean' },
                      latencyMs: { type: 'number' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid input or text too short' },
          },
        },
      },
      '/api/batch-detect': {
        post: {
          summary: 'Batch Multi-Text Forensic Detection',
          description:
            'Evaluates up to 10 prose passages concurrently with SHA-256 caching and per-item forensic breakdowns.',
          operationId: 'batchDetectTexts',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    items: {
                      type: 'array',
                      maxItems: 10,
                      items: {
                        type: 'object',
                        required: ['text'],
                        properties: {
                          id: { type: 'string' },
                          text: { type: 'string' },
                          domain: {
                            type: 'string',
                            enum: ['general', 'academic', 'technical', 'creative', 'esl-fair'],
                            default: 'general',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful batch evaluation',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer' },
                      items: { type: 'array' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation error or batch size > 10' },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
