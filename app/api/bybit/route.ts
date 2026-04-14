import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '/v5/market/tickers';
  const params = new URLSearchParams();

  searchParams.forEach((value, key) => {
    if (key !== 'path') params.set(key, value);
  });

  const bybitUrl = `https://api.bybit.com${path}?${params.toString()}`;

  try {
    const res = await fetch(bybitUrl, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CryptoMasterDashboard/1.0',
      },
      next: { revalidate: 0 },
    });

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Falha ao conectar na Bybit API', details: String(error) },
      { status: 502 }
    );
  }
}
