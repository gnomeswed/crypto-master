import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Faltou o caminho path' }, { status: 400 });
    }

    // Copiamos os outros parâmetros
    const queryParams = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key !== 'path') {
        queryParams.set(key, value);
      }
    });

    // Categoria padrão
    if (!queryParams.has('category')) {
      queryParams.set('category', 'linear');
    }

    const queryString = queryParams.toString();
    const targetUrl = `https://api.bytick.com${path}?${queryString}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    // Tenta autenticar se as chaves existirem
    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;

    if (apiKey && apiSecret && apiKey.trim() !== '' && apiSecret.trim() !== '') {
      try {
        const timestamp = Date.now().toString();
        const recvWindow = '5000';
        const signature = crypto
          .createHmac('sha256', apiSecret)
          .update(timestamp + apiKey + recvWindow + queryString)
          .digest('hex');

        headers['X-BAPI-API-KEY'] = apiKey;
        headers['X-BAPI-SIGN'] = signature;
        headers['X-BAPI-TIMESTAMP'] = timestamp;
        headers['X-BAPI-RECV-WINDOW'] = recvWindow;
      } catch (authErr: any) {
        console.error('Erro na assinatura:', authErr);
        // Prossegue sem autenticação se a assinatura falhar por algum motivo
      }
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Falha Geral no Proxy',
      message: error.message,
      type: error.name
    }, { status: 500 });
  }
}
