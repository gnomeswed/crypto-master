import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams(searchParams);
    const path = params.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Faltou o caminho (path)' }, { status: 400 });
    }

    params.delete('path');
    if (!params.has('category')) {
      params.append('category', 'linear');
    }

    // LISTA DE ENDPOINTS ALTERNATIVOS (BYBIT / BYTICK)
    // Tentar primeiro bytick.com que é menos restrito para servidores cloud
    const endpoints = [
      `https://api.bytick.com${path}?${params.toString()}`,
      `https://api.bybit.com${path}?${params.toString()}`
    ];
    
    let lastError = null;
    
    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.bybit.com/',
            'Origin': 'https://www.bybit.com'
          },
          cache: 'no-store'
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store, max-age=0',
            }
          });
        }
        
        lastError = `Status ${response.status}`;
      } catch (e: any) {
        lastError = e.message;
      }
    }

    return NextResponse.json({ 
      error: 'Bybit bloqueou todos os túneis',
      detail: lastError 
    }, { status: 403 });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Erro Crítico no Proxy',
      message: error.message 
    }, { status: 500 });
  }
}
