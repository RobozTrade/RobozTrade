import { createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet, metaMask } from 'wagmi/connectors';

// WalletConnect Project ID
const projectId = 'e9eee19e35b12b88aa0eff7f0ddaef7e';

export const config = createConfig({
  chains: [bsc],
  connectors: [
    walletConnect({
      projectId,
      metadata: {
        name: 'RobozTrade',
        description: 'AI-Powered Trading Bot Platform',
        url: 'https://roboztrade.com',
        icons: ['https://roboztrade.com/icon.png'],
      },
    }),
    metaMask(),
    injected(),
    coinbaseWallet({
      appName: 'RobozTrade',
    }),
  ],
  transports: {
    [bsc.id]: http(),
  },
});

// BSC USDT Contract Address
export const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

// Recipient address for bot payments
export const PAYMENT_RECIPIENT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1';

// Required payment amount
export const REQUIRED_PAYMENT_AMOUNT = '10';

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

