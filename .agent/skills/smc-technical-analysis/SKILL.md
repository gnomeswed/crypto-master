# Skill: SMC Technical Analysis

Esta skill define os padrões e lógicas de Smart Money Concepts (SMC) utilizados para identificar oportunidades de alta probabilidade no mercado de criptoativos.

## 📚 Conceitos Fundamentais

### 1. Liquidez Institucional (PDH / PDL)
- **PDH (Previous Day High)**: Máxima do dia anterior. Atua como um ímã de liquidez vendedora.
- **PDL (Previous Day Low)**: Mínima do dia anterior. Atua como um ímã de liquidez compradora.
- **EQL / EQH**: Fundos ou topos iguais. São zonas altamente "sujas" onde o varejo coloca stops. O robô deve buscar o sweep dessas áreas.

### 2. O Sweep (Liquidity Grab)
- Ocorre quando o preço ultrapassa um nível de liquidez mas fecha o candle **dentro** do nível anterior.
- **Identificação**: Wick (pavio) longo furando o nível.
- **Sinal**: Indica que as instituições "limparam" os stops e estão prontas para inverter o preço.

### 3. CHoCH (Change of Character)
- É a primeira quebra da estrutura de tendência após um sweep.
- Se o preço varreu o PDL (fundo) e depois quebrou o topo do último candle de baixa, temos um CHoCH de alta.

### 4. Order Block (OB)
- A última vela antes de um movimento impulsivo que gera um BOS ou CHoCH.
- É onde as ordens institucionais foram abertas. O ponto de entrada ideal é no reteste (mitigação) deste bloco.

## 🛠️ Lógica de Scrutiny (Scanner)
- **Score 0-3**: Acumulação lateral sem alvo claro.
- **Score 4-6**: Preço se aproximando de liquidez (Laranja).
- **Score 7-9**: Sweep confirmado + Reação inicial.
- **Score 10**: CHoCH confirmado no M15 + Reteste no Order Block. (Ponto de Entrada Elite).
