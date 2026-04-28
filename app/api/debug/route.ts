import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, url } = await req.json();

    // Step 1: content extraction test
    const { extractContent } = await import('@/lib/extract-content');
    const { title, content } = await extractContent(url ?? 'https://example.com');

    // Step 2: AI SDK test
    const { generateText } = await import('ai');

    let model;
    if (provider === 'anthropic') {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      model = createAnthropic({ apiKey })('claude-haiku-4-5-20251001');
    } else if (provider === 'google') {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      model = createGoogleGenerativeAI({ apiKey })('gemini-1.5-flash-latest');
    } else {
      const { createOpenAI } = await import('@ai-sdk/openai');
      model = createOpenAI({ apiKey })('gpt-4o-mini');
    }

    const { text } = await generateText({
      model,
      prompt: `다음 글을 한 문장으로 요약해줘: ${content.slice(0, 500)}`,
    });

    return NextResponse.json({ ok: true, title, preview: text.slice(0, 200) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json({ ok: false, error: message, stack }, { status: 500 });
  }
}
