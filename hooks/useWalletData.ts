import { useCallback, useEffect, useRef, useState } from 'react';
import { driverService } from '@/services/driverService';
import type { DriverTopup, DriverWallet, WalletCommissionTransaction } from '@/types/driver';
import { isSupabaseConfigured } from '@/lib/env';

/**
 * Espelha `loadData` / `loadDiscountData` de `Zamba-Motorista-/src/pages/Wallet.tsx`.
 */
export function useWalletData(userId: string | undefined) {
  const [wallet, setWallet] = useState<DriverWallet | null>(null);
  const [topups, setTopups] = useState<DriverTopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentDiscountRate, setCurrentDiscountRate] = useState<number | null>(null);
  const [discounts, setDiscounts] = useState<WalletCommissionTransaction[]>([]);
  const [loadingRate, setLoadingRate] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorRate, setErrorRate] = useState<string | null>(null);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadDiscountData = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      if (isMounted.current) {
        setLoadingRate(false);
        setLoadingHistory(false);
      }
      return;
    }

    setLoadingRate(true);
    setLoadingHistory(true);
    setErrorRate(null);
    setErrorHistory(null);

    try {
      const rate = await driverService.getCurrentDiscountRate();
      if (isMounted.current) setCurrentDiscountRate(rate);
    } catch {
      if (isMounted.current) setErrorRate('Não foi possível carregar a taxa atual');
    } finally {
      if (isMounted.current) setLoadingRate(false);
    }

    try {
      const history = await driverService.getWalletTransactions(userId);
      if (isMounted.current) setDiscounts(history);
    } catch {
      if (isMounted.current) setErrorHistory('Não foi possível carregar o histórico de descontos');
    } finally {
      if (isMounted.current) setLoadingHistory(false);
    }
  }, [userId]);

  const loadData = useCallback(
    async (showLoading = true) => {
      if (!userId || !isSupabaseConfigured) {
        if (isMounted.current) setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const [w, t] = await Promise.all([
          driverService.getWallet(userId),
          driverService.getTopups(userId),
        ]);
        if (isMounted.current) {
          setWallet(w);
          setTopups(t);
        }
      } catch {
        if (isMounted.current) {
          setError('Não foi possível carregar os dados da carteira. Verifique sua conexão.');
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }

      void loadDiscountData();
    },
    [userId, loadDiscountData],
  );

  const reloadDiscountRate = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) return;
    setLoadingRate(true);
    setErrorRate(null);
    try {
      const rate = await driverService.getCurrentDiscountRate();
      if (isMounted.current) setCurrentDiscountRate(rate);
    } catch {
      if (isMounted.current) setErrorRate('Não foi possível carregar a taxa atual');
    } finally {
      if (isMounted.current) setLoadingRate(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  return {
    wallet,
    topups,
    loading,
    error,
    loadData,
    currentDiscountRate,
    discounts,
    loadingRate,
    loadingHistory,
    errorRate,
    errorHistory,
    loadDiscountData,
    reloadDiscountRate,
  };
}
