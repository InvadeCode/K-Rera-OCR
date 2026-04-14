import { NextRequest, NextResponse } from 'next/server';
import {
  extractTextFromGeminiResponse,
  geminiGenerateContent,
  responseJsonSchema,
} from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const images = Array.isArray(body?.images) ? body.images : [];

    if (!images.length) {
      return NextResponse.json(
        { error: 'No images were provided.' },
        { status: 400 },
      );
    }

    const prompt = `Statutory Scrutiny for K-RERA Kerala Rules 2018.
HARD-FAIL: If any mention of Maharashtra, MahaRERA, Mumbai, 7/12 Extract, Village Form, or Property Card exists, set jurisdiction="Mismatch".
Scan for violations in Para 1.2 (Super Built-up Area), Para 7.3 (Penalty Charges), and Para 11 (Interest commencement).
Return valid JSON only.`;

    const data = await geminiGenerateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...images.map((img: string) => ({
              inlineData: {
                mimeType: 'image/png',
                data: img,
              },
            })),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema,
        temperature: 0.1,
      },
    });

    const text = extractTextFromGeminiResponse(data);
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Audit batch failed unexpectedly.',
      },
      { status: 500 },
    );
  }
}
