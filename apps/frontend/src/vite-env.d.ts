/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;

  // WalletConnect Configuration
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;

  // App Metadata
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_DESCRIPTION: string;
  readonly VITE_APP_URL: string;
  readonly VITE_APP_ICON: string;

  // Blockchain Configuration
  readonly VITE_USDT_CONTRACT_ADDRESS: string;
  readonly VITE_PAYMENT_RECIPIENT_ADDRESS: string;
  readonly VITE_REQUIRED_PAYMENT_AMOUNT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

