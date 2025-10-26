import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the URL from query parameter
  const urlParam = request.nextUrl.searchParams.get('url');
  
  if (!urlParam) {
    // Legacy support: get pathname for old format
    const pathname = request.nextUrl.pathname.replace('/api/hls-proxy', '');
    
    // Forward to 100ms
    const targetUrl = `https://liveshopping.app.100ms.live${pathname}`;
    
    console.log('[API] Fetching HLS from:', targetUrl);
    
    return await fetchAndProxy(targetUrl);
  }

  // Use the provided URL
  const targetUrl = decodeURIComponent(urlParam);
  console.log('[API] Fetching HLS from:', targetUrl);
  
  return await fetchAndProxy(targetUrl);
}

async function fetchAndProxy(targetUrl: string) {
  try {
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      console.error('[API] Error response:', response.status);
      return NextResponse.json(
        { error: `Failed to fetch HLS content: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.text();

    console.log('[API] Response status:', response.status);
    console.log('[API] Response preview:', data.substring(0, 200));

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (error) {
    console.error('[API] Error fetching HLS:', error);
    return NextResponse.json(
      { error: 'Failed to fetch HLS content' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

