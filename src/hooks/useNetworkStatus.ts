'use client';

import { useState, useEffect } from 'react';

/**
 * Hook que escuta os eventos `online`/`offline` do navegador.
 * Retorna `true` quando a artesã está conectada, `false` quando offline.
 *
 * Usado pelo indicador visual de status na Navbar para informar que os dados
 * estão sendo salvos localmente (Firestore persistentLocalCache) e serão
 * sincronizados quando a conexão voltar.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Inicializa com o estado atual do navegador
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
