import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SignalProvider } from '@/lib/SignalContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Dashboard SaaS - Bybit SMC',
  description: 'Sistema avançado de monitoramento e cálculo de fluxo institucional SMC para mercado cripto.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} antialiased`}>
        <SignalProvider>
          {children}
        </SignalProvider>
      </body>
    </html>
  );
}
