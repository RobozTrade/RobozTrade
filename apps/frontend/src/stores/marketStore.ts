import { create } from 'zustand';
import type { TickerData } from '@roboz-trade/shared-types';

interface MarketState {
  prices: Record<string, number>;
  tickers: Record<string, TickerData>;
  updatePrice: (symbol: string, price: number) => void;
  updateTicker: (symbol: string, ticker: TickerData) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  prices: {},
  tickers: {},
  updatePrice: (symbol, price) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: price },
    })),
  updateTicker: (symbol, ticker) =>
    set((state) => ({
      tickers: { ...state.tickers, [symbol]: ticker },
    })),
}));

