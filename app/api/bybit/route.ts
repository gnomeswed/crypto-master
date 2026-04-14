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

    // Usando URL absoluta para evitar ambiguidades no ambiente Vercel
    const bybitUrl = `https://api.bybit.com${path}?${params.toString()}`;
    
    // Configurações de Fetch otimizadas para Serverless
    const response = await fetch(bybitUrl, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      next: { revalidate: 1 } // Mantém cache por apenas 1 segundo
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      return NextResponse.json({ 
        error: `Bybit negou acesso (${response.status})`,
        detail: errorDetail.substring(0, 50)
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=1, stale-while-revalidate=5',
      }
    });
  } catch (error: any) {
    // Retornamos o erro REAL para o rastreador mostrar na tela
    return NextResponse.json({ 
      error: 'Falha no Túnel Vercel',
      message: error.message 
    }, { status: 500 });
  }
}
