import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const queryString = params.toString();

    // Endpoints Oficiais (Bytick é mais estável para Cloud)
    const baseUrl = 'https://api.bytick.com';
    const fullUrl = `${baseUrl}${path}?${queryString}`;

    // Construindo a Assinatura Digital (Bybit v5 Protocol)
    const signature = crypto
      .createHmac('sha256', apiSecret || '')
      .update(timestamp + (apiKey || '') + recvWindow + queryString)
      .digest('hex');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CryptoMaster-Dash/1.0',
    };

    // Só adicionamos a autenticação se as chaves existirem
    if (apiKey && apiSecret) {
      headers['X-BAPI-API-KEY'] = apiKey;
      headers['X-BAPI-SIGN'] = signature;
      headers['X-BAPI-TIMESTAMP'] = timestamp;
      headers['X-BAPI-RECV-WINDOW'] = recvWindow;
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: `Bybit recusou (${response.status})`,
        detail: data?.retMsg || 'Erro desconhecido'
      }, { status: response.status });
    }

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Erro Crítico no Proxy Autenticado',
      message: error.message 
    }, { status: 500 });
  }
}
