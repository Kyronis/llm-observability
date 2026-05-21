import { NextResponse } from 'next/server';
import { getProject } from '@/lib/db';

/**
 * GET /api/langfuse/traces?projectId=xxx&traceId=xxx&page=1&limit=50&name=xxx&sessionId=xxx&fromTimestamp=xxx&toTimestamp=xxx
 * Proxy to Langfuse Public API for trace data with search/filter support
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const traceId = searchParams.get('traceId');
    const page = searchParams.get('page') ?? '1';
    const limit = searchParams.get('limit') ?? '50';

    // Search/filter parameters supported by Langfuse API
    const name = searchParams.get('name');
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const fromTimestamp = searchParams.get('fromTimestamp');
    const toTimestamp = searchParams.get('toTimestamp');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const baseUrl = project.langfuseBaseUrl.replace(/\/+$/, '');
    const auth = Buffer.from(`${project.langfusePublicKey}:${project.langfuseSecretKey}`).toString('base64');
    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    };

    if (traceId) {
      // 并行获取 trace 详情和 observations 列表
      const traceUrl = `${baseUrl}/api/public/traces/${traceId}`;
      const obsUrl = `${baseUrl}/api/public/observations?traceId=${traceId}&limit=100`;

      const [traceRes, obsRes] = await Promise.all([
        fetch(traceUrl, { headers, signal: AbortSignal.timeout(30000) }),
        fetch(obsUrl, { headers, signal: AbortSignal.timeout(30000) }),
      ]);

      if (!traceRes.ok) {
        return NextResponse.json(
          { error: `Langfuse API error: ${traceRes.status}` },
          { status: traceRes.status },
        );
      }

      const traceData = await traceRes.json();

      // 合并完整 observations 数据到 trace 响应中
      if (obsRes.ok) {
        const obsData = await obsRes.json();
        // v2 API 返回 { data: [...] }，旧版返回数组
        const observations = Array.isArray(obsData) ? obsData : (obsData.data ?? []);
        traceData.observations = observations;
      }

      return NextResponse.json(traceData);
    } else {
      // Build query string with all supported filter parameters
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', limit);
      if (name) params.set('name', name);
      if (sessionId) params.set('sessionId', sessionId);
      if (userId) params.set('userId', userId);
      if (fromTimestamp) params.set('fromTimestamp', fromTimestamp);
      if (toTimestamp) params.set('toTimestamp', toTimestamp);

      const url = `${baseUrl}/api/public/traces?${params.toString()}`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Langfuse API error: ${res.status}` },
          { status: res.status },
        );
      }

      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Langfuse proxy error:', error);
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 500 });
  }
}
