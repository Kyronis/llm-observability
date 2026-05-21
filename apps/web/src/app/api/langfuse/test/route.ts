import { NextResponse } from 'next/server';

/**
 * POST /api/langfuse/test
 * Test connection to a Langfuse instance
 */
export async function POST(request: Request) {
  try {
    const { baseUrl, publicKey, secretKey } = await request.json();

    if (!baseUrl || !publicKey || !secretKey) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/api/public/projects`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      return NextResponse.json({ success: true });
    } else {
      const text = await res.text().catch(() => '');
      return NextResponse.json({
        success: false,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json({ success: false, error: msg });
  }
}
