import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { CheckCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { 
  USDT_CONTRACT_ADDRESS, 
  PAYMENT_RECIPIENT_ADDRESS, 
  REQUIRED_PAYMENT_AMOUNT,
  USDT_ABI 
} from '@/lib/wagmi';

interface PaymentFlowProps {
  onPaymentComplete: (txHash: string) => void;
}

export function PaymentFlow({ onPaymentComplete }: PaymentFlowProps) {
  const { address } = useAccount();
  const [error, setError] = useState<string>('');

  const { 
    data: hash, 
    writeContract, 
    isPending: isWritePending,
    error: writeError 
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash,
  });

  const handlePayment = async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }

    setError('');

    try {
      // Convert 10 USDT to wei (USDT has 18 decimals on BSC)
      const amount = parseUnits(REQUIRED_PAYMENT_AMOUNT, 18);

      writeContract({
        address: USDT_CONTRACT_ADDRESS as `0x${string}`,
        abi: USDT_ABI,
        functionName: 'transfer',
        args: [PAYMENT_RECIPIENT_ADDRESS as `0x${string}`, amount],
      });
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to send payment');
    }
  };

  // When transaction is confirmed, notify parent
  if (isConfirmed && hash) {
    onPaymentComplete(hash);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-4">
          Payment Required
        </h3>
        
        <div className="bg-surface-light rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-text-secondary">Amount:</span>
            <span className="text-2xl font-bold text-text-primary">
              {REQUIRED_PAYMENT_AMOUNT} USDT
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Recipient:</span>
            <span className="text-text-primary font-mono text-xs">
              {PAYMENT_RECIPIENT_ADDRESS.slice(0, 10)}...{PAYMENT_RECIPIENT_ADDRESS.slice(-8)}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-error">Payment Error</p>
              <p className="text-text-secondary mt-1">{error}</p>
            </div>
          </div>
        )}

        {writeError && (
          <div className="bg-error/10 border border-error rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-error">Transaction Error</p>
              <p className="text-text-secondary mt-1">{writeError.message}</p>
            </div>
          </div>
        )}

        {!hash && (
          <button
            onClick={handlePayment}
            disabled={isWritePending || !address}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {isWritePending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Waiting for confirmation...
              </>
            ) : (
              <>Pay {REQUIRED_PAYMENT_AMOUNT} USDT</>
            )}
          </button>
        )}

        {hash && !isConfirmed && (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary rounded-lg p-4 flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-primary">Transaction Submitted</p>
                <p className="text-sm text-text-secondary mt-1">
                  Waiting for blockchain confirmation...
                </p>
                <a
                  href={`https://bscscan.com/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
                >
                  View on BscScan
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {isConfirmed && hash && (
          <div className="bg-success/10 border border-success rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-success">Payment Confirmed!</p>
              <p className="text-sm text-text-secondary mt-1">
                Your payment has been confirmed on the blockchain.
              </p>
              <a
                href={`https://bscscan.com/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-success hover:underline flex items-center gap-1 mt-2"
              >
                View on BscScan
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-surface-light rounded-lg">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">Important:</strong>
          </p>
          <ul className="text-sm text-text-secondary mt-2 space-y-1 list-disc list-inside">
            <li>This is a one-time payment for bot creation</li>
            <li>Transaction requires at least 3 confirmations</li>
            <li>Make sure you have enough BNB for gas fees</li>
            <li>Do not close this page until payment is confirmed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

