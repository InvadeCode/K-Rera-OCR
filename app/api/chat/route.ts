import { NextRequest, NextResponse } from 'next/server';
import {
  extractTextFromGeminiResponse,
  geminiGenerateContent,
} from '@/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const report = body?.report ?? null;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required.' },
        { status: 400 },
      );
    }

    const prompt = `You are a K-RERA Legal Consultant.
Base answers strictly on Kerala Real Estate Rules 2018.
Use this report context when relevant:
${JSON.stringify(report ?? {}, null, 2)}

User question:
${message}`;

    const data = await geminiGenerateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    });

    const text = extractTextFromGeminiResponse(data);

    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Chat request failed unexpectedly.',
      },
      { status: 500 },
    );
  }
}
