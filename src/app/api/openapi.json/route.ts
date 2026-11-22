import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Veritext legacy style-signal API",
      version: "4.5.1",
      description:
        "These server endpoints compute uncalibrated style heuristics only. They do not run the browser neural detector. aiScore is a legacy 0–100 style index, not an authorship probability. Submitted text reaches the server. There is no hosted humanizer API.",
    },
    paths: {
      "/api/health": {
        get: {
          responses: {
            "200": {
              description:
                "Server configuration; client model readiness is unknown",
            },
          },
        },
      },
      "/api/detect": {
        post: {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["text"],
                  properties: {
                    text: { type: "string", minLength: 10, maxLength: 100000 },
                    domain: {
                      type: "string",
                      enum: [
                        "general",
                        "academic",
                        "technical",
                        "creative",
                        "esl-fair",
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Legacy heuristic signals with explicit uncertainty",
            },
            "400": { description: "Invalid JSON or input" },
          },
        },
      },
      "/api/batch-detect": {
        post: {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["items"],
                  properties: {
                    items: {
                      type: "array",
                      minItems: 1,
                      maxItems: 10,
                      items: {
                        type: "object",
                        required: ["text"],
                        properties: {
                          id: { type: "string" },
                          text: {
                            type: "string",
                            minLength: 5,
                            maxLength: 20000,
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
            "200": { description: "Up to 10 legacy style-signal records" },
            "400": { description: "Invalid JSON or input" },
          },
        },
      },
    },
  });
}
