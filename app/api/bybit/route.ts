import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

export const runtime = "nodejs";

const serverCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5_000;

export async function GET(request: NextRequest) {
  try {
    const url    = new URL(request.url);
    const path   = url.searchParams.get("path");
    if (!path) return NextResponse.json({ error: "Faltou path" }, { status: 400 });

    const queryParams = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (key !== "path") queryParams.set(key, value);
    });
    if (!queryParams.has("category")) queryParams.set("category", "linear");

    const queryString = queryParams.toString();
    const cacheKey    = `${path}?${queryString}`;

    const cached = serverCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json(cached.data, {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "X-Cache": "HIT" },
      });
    }

    const targetUrl = `https://api.bytick.com${path}?${queryString}`;

    const headers: Record<string, string> = {
      "Content-Type":  "application/json",
      "User-Agent":    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0",
    };

    // Apenas assinar rotas privadas (ex: trade/position/order).
    // Rotas públicas de mercado (/v5/market/) NÃO devem ser assinadas
    // para evitar bloqueios de IP Restrito (API Key vinculada a IP da máquina local).
    if (!path.startsWith("/v5/market/")) {
      const apiKey    = process.env.BYBIT_API_KEY;
      const apiSecret = process.env.BYBIT_API_SECRET;
      if (apiKey && apiSecret && apiKey.trim() && apiSecret.trim()) {
        try {
          const timestamp  = Date.now().toString();
          const recvWindow = "5000";
          const sig = crypto.createHmac("sha256", apiSecret)
            .update(timestamp + apiKey + recvWindow + queryString)
            .digest("hex");
          headers["X-BAPI-API-KEY"]      = apiKey;
          headers["X-BAPI-SIGN"]         = sig;
          headers["X-BAPI-TIMESTAMP"]    = timestamp;
          headers["X-BAPI-RECV-WINDOW"]  = recvWindow;
        } catch {}
      }
    }

    const response = await fetch(targetUrl, { method: "GET", headers, cache: "no-store" });
    const textData = await response.text();
    let data;
    try {
      data = JSON.parse(textData);
    } catch (e) {
      return NextResponse.json({ error: "Cloudflare Block/Invalid JSON", response: textData.substring(0,200) }, { status: 502 });
    }

    if (response.ok) serverCache.set(cacheKey, { data, ts: Date.now() });

    return NextResponse.json(data, {
      status: response.status,
      headers: { "Access-Control-Allow-Origin": "*", "X-Cache": "MISS" },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Falha no Proxy", message: error.message }, { status: 500 });
  }
}
