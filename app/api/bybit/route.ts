import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const category = searchParams.get('category') || 'linear';

  if (!path) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  try {
    const bybitUrl = `https://api.bybit.com${path}${path.includes('?') ? '&' : '?'}category=${category}`;
    
    const response = await fetch(bybitUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 0 } // Garante dados sempre frescos
    });

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Erro na API Bybit Proxy:', error);
    return NextResponse.json({ error: 'Falha ao buscar dados da Bybit' }, { status: 500 });
  }
}
