'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '@/lib/types';

interface Props {
  data: ChartDataPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="font-mono text-xs p-2"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-bright)',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ color: 'var(--green)' }}>
        Acertividade: {payload[0].value.toFixed(1)}%
      </div>
    </div>
  );
}

export default function AccuracyChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="card" style={{ background: 'var(--bg-surface)' }}>
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="font-mono text-xs font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
            ◎ EVOLUÇÃO DA ACERTIVIDADE
          </span>
        </div>
        <div className="p-8 text-center">
          <p className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
            Registre pelo menos 2 sinais fechados para ver o gráfico.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ background: 'var(--bg-surface)' }}>
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="font-mono text-xs font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
          ◎ EVOLUÇÃO DA ACERTIVIDADE
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="acertividade"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#greenGrad)"
              dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#22c55e', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2">
          {data.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <div style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: 0 }} />
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                  Atual: {data[data.length - 1]?.acertividade.toFixed(1)}%
                </span>
              </div>
              <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                {data[data.length - 1]?.totalAcumulado} trades fechados
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
