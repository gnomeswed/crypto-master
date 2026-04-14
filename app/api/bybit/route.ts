import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Força o uso do runtime Node.js para compatibilidade total com o módulo crypto
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams(searchParams);
    const path = params.get('path');
    
    if (!path) {
      return NextResponse.json({ error: 'Faltou o caminho (path)' }, { status: 400 });
    }

    // Limpeza de parâmetros para a Bybit
    params.delete('path');
    if (!params.has('category')) {
      params.append('category', 'linear');
    }

    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const queryString = params.toString();

    // Construção da URL de destino
    const baseUrl = 'https://api.bytick.com';
    const fullUrl = `${baseUrl}${path}?${queryString}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CryptoMaster-Dash/1.1',
    };

    // DEBUG: Se as chaves existirem, gera a assinatura digital
    if (apiKey && apiSecret) {
      try {
        const signature = crypto
          .createHmac('sha256', apiSecret)
          .update(timestamp + apiKey + recvWindow + queryString)
          .digest('hex');

        headers['X-BAPI-API-KEY'] = apiKey;
        headers['X-BAPI-SIGN'] = signature;
        headers['X-BAPI-TIMESTAMP'] = timestamp;
        headers['X-BAPI-RECV-WINDOW'] = recvWindow;
      } catch (cryptoErr: any) {
        return NextResponse.json({ 
          error: 'Erro ao gerar assinatura digital',
          detail: cryptoErr.message 
        }, { status: 500 });
      }
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    const data = await response.json();

    if (!response.ok) {
      // Se a Bybit recusar, mostramos o porquê (pode ser chave inválida ou permissão)
      return NextResponse.json({ 
        error: `Bybit recusou o acesso`,
        code: data?.retCode,
        msg: data?.retMsg || 'Erro desconhecido na rede Bybit'
      }, { status: response.status });
    }

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0',
      }
    });

  } catch (error: any) {
    // Captura erros globais de rede ou lógica
    return NextResponse.json({ 
      error: 'Falha Crítica na Comunicação Cloud',
      message: error.message 
    }, { status: 500 });
  }
}
