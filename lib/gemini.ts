const GEMINI_MODEL = 'gemini-2.5-flash';

export const responseJsonSchema = {
  type: 'object',
  properties: {
    jurisdiction: {
      type: 'string',
      enum: ['Kerala', 'Mismatch'],
    },
    project: {
      type: 'string',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          para: { type: 'string' },
          severity: {
            type: 'string',
            enum: ['CRITICAL', 'MINOR'],
          },
          finding: { type: 'string' },
          rectification: { type: 'string' },
        },
        required: ['para', 'severity', 'finding', 'rectification'],
      },
    },
  },
  required: ['jurisdiction', 'project', 'findings'],
} as const;

export function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  return key;
}

export async function geminiGenerateContent(body: unknown) {
  const key = getGeminiKey();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data?.error?.message || `Gemini request failed with status ${res.status}`;
    throw new Error(message);
  }

  return data;
}

export function extractTextFromGeminiResponse(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini returned an empty response.');
  }

  const text = parts
    .map((part: { text?: string }) => part?.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned no text output.');
  }

  return text;
}
