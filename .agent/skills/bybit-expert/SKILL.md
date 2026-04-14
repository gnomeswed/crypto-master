# Skill: Bybit Expert (V5 API)

Domínio técnico completo sobre a arquitetura de dados da Bybit para garantir integridade e velocidade de resposta.

## 📡 Endpoints Críticos (V5)
- **Market Tickers**: `/v5/market/tickers?category=linear` (Para scan global de volume e sentimento).
- **Klines/Candlesticks**: `/v5/market/kline` (Para análise técnica estrutural).
- **Orderbook**: `/v5/market/orderbook` (Para verificar profundidade de liquidez).

## ⚡ Otimização de Performance
1. **Batching**: Sempre que possível, buscar múltiplos ativos em uma única chamada de Ticker.
2. **Intervalos**: 
   - Use `interval=D` para níveis macro (PDH/PDL).
   - Use `interval=15` ou `interval=60` para detecção de gatilho (Sweep/CHoCH).
3. **CORS Handling**: Todas as chamadas devem passar pelo Proxy Local (`/api/bybit`) para evitar bloqueios de navegador.

## 🔐 Segurança
- **API Keys**: Devem ser tratadas via `localStorage` ou variáveis de ambiente. Nunca hardcoded.
- **Rate Limits**: monitorar os cabeçalhos de resposta para evitar erros `429` (Too Many Requests).
