import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Wallet, LogOut, AlertCircle } from 'lucide-react';
import { bsc } from 'wagmi/chains';
import { USDT_CONTRACT_ADDRESS } from '@/lib/wagmi';

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  // Get USDT balance
  const { data: usdtBalance } = useBalance({
    address,
    token: USDT_CONTRACT_ADDRESS as `0x${string}`,
    chainId: bsc.id,
  });

  // Get BNB balance for gas
  const { data: bnbBalance } = useBalance({
    address,
    chainId: bsc.id,
  });

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="font-medium text-text-primary">
                {formatAddress(address)}
              </span>
            </div>
            <button
              onClick={() => disconnect()}
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>

          {chain?.id !== bsc.id && (
            <div className="bg-warning/10 border border-warning rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Wrong Network</p>
                <p className="text-text-secondary mt-1">
                  Please switch to BSC Mainnet in your wallet
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">USDT Balance:</span>
              <span className="font-medium text-text-primary">
                {usdtBalance ? `${parseFloat(usdtBalance.formatted).toFixed(2)} USDT` : '0.00 USDT'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">BNB Balance (Gas):</span>
              <span className="font-medium text-text-primary">
                {bnbBalance ? `${parseFloat(bnbBalance.formatted).toFixed(4)} BNB` : '0.0000 BNB'}
              </span>
            </div>
          </div>

          {bnbBalance && parseFloat(bnbBalance.formatted) < 0.001 && (
            <div className="bg-warning/10 border border-warning rounded-lg p-3 mt-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Low BNB Balance</p>
                <p className="text-text-secondary mt-1">
                  You need BNB for transaction fees. Please add some BNB to your wallet.
                </p>
              </div>
            </div>
          )}

          {usdtBalance && parseFloat(usdtBalance.formatted) < 10 && (
            <div className="bg-warning/10 border border-warning rounded-lg p-3 mt-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Insufficient USDT</p>
                <p className="text-text-secondary mt-1">
                  You need at least 10 USDT to create a bot. Current balance: {parseFloat(usdtBalance.formatted).toFixed(2)} USDT
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Connect Your Wallet
        </h3>
        <p className="text-text-secondary mb-6">
          Connect your wallet to pay the 10 USDT bot creation fee on BSC Mainnet
        </p>

        <button
          onClick={() => open()}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </button>

        <div className="mt-6 p-4 bg-surface-light rounded-lg">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Note:</strong> Make sure you have:
          </p>
          <ul className="text-sm text-text-secondary mt-2 space-y-1 list-disc list-inside">
            <li>At least 10 USDT on BSC Mainnet</li>
            <li>Some BNB for transaction fees (~0.001 BNB)</li>
            <li>Your wallet connected to BSC Mainnet</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

