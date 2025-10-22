import { createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

// Reown (WalletConnect) Project ID - from environment variable
export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'e9eee19e35b12b88aa0eff7f0ddaef7e';

// Metadata for Reown AppKit - configurable via environment variables
export const metadata = {
  name: import.meta.env.VITE_APP_NAME || 'RobozTrade',
  description: import.meta.env.VITE_APP_DESCRIPTION || 'AI-Powered Trading Bot Platform',
  url: import.meta.env.VITE_APP_URL || 'https://roboz.trade',
  icons: [import.meta.env.VITE_APP_ICON || 'https://roboz.trade/icon.png'],
};

export const config = createConfig({
  chains: [bsc],
  connectors: [
    walletConnect({
      projectId,
      metadata,
      showQrModal: false, // We'll use Reown AppKit modal instead
    }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: metadata.name,
    }),
  ],
  transports: {
    [bsc.id]: http(),
  },
});

// BSC USDT Contract Address - from environment variable
export const USDT_CONTRACT_ADDRESS = import.meta.env.VITE_USDT_CONTRACT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';

// Recipient address for bot payments - from environment variable
export const PAYMENT_RECIPIENT_ADDRESS = import.meta.env.VITE_PAYMENT_RECIPIENT_ADDRESS || '0xB8b687E16BD6Ce3E37e6f9fd534542F75009c86B';

// Required payment amount - from environment variable
export const REQUIRED_PAYMENT_AMOUNT = import.meta.env.VITE_REQUIRED_PAYMENT_AMOUNT || '10';

// USDT ABI (minimal - just what we need for transfer)
export const USDT_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

