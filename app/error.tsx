'use client';

import { useEffect } from 'react';
import logger from '@/lib/logger';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Erro na aplicação:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Algo deu errado!</h2>
        <p className="mb-4">Ocorreu um erro inesperado na aplicação.</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}