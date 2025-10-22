import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { bsc } from 'wagmi/chains';
import { config, projectId, metadata } from '@/lib/wagmi';

const queryClient = new QueryClient();

// Create Reown AppKit modal
const wagmiAdapter = new WagmiAdapter({
  networks: [bsc],
  projectId,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [bsc],
  projectId,
  metadata,
  features: {
    analytics: true,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#007aff',
    '--w3m-border-radius-master': '12px',
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

