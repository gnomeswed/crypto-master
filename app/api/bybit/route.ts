import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pegamos todos os parâmetros da URL que o robô enviou
    const params = new URLSearchParams(searchParams);
    const path = params.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Faltou o caminho (path)' }, { status: 400 });
    }

    // Removemos o 'path' da lista para não duplicar na Bybit
    params.delete('path');
    
    // Garantimos que a categoria seja 'linear' se não for especificada
    if (!params.has('category')) {
      params.append('category', 'linear');
    }

    const bybitUrl = `https://api.bybit.com${path}?${params.toString()}`;
    
    console.log('Proxying to:', bybitUrl); // Debug log no servidor

    const response = await fetch(bybitUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno no Proxy' }, { status: 500 });
  }
}
