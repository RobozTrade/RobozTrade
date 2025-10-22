import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Wallet, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { GlassCard, GlassButton, GlassInput } from "@/components/ui/GlassCard";

export function WalletAuth() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { signMessageAsync } = useSignMessage();
  const { setWalletAuth } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const handleWalletAuth = async () => {
    if (!address || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Step 1: Get nonce from backend
      const nonceResponse = await api.getNonce({ walletAddress: address });
      
      if (!nonceResponse.success || !nonceResponse.data) {
        throw new Error(nonceResponse.error || "Failed to get nonce");
      }

      const { nonce, message } = nonceResponse.data;
      const timestamp = Date.now();

      // Step 2: Sign the message with wallet
      const signature = await signMessageAsync({ message });

      // Step 3: Verify signature with backend (first attempt without name)
      const verifyResponse = await api.verifyWalletSignature({
        walletAddress: address,
        signature,
        nonce,
        timestamp,
      });

      if (verifyResponse.success && verifyResponse.data) {
        // Authentication successful
        const { user, token, isNewUser } = verifyResponse.data;
        setWalletAuth(user, token, address);
        
        if (isNewUser) {
          navigate("/app/dashboard?welcome=true");
        } else {
          navigate("/app/dashboard");
        }
      } else if (verifyResponse.error?.includes("Display name required")) {
        // New user - need to collect name
        setShowNameInput(true);
        setLoading(false);
      } else {
        throw new Error(verifyResponse.error || "Authentication failed");
      }
    } catch (err: any) {
      console.error("Wallet authentication error:", err);
      setError(err.message || "Failed to authenticate with wallet");
      setLoading(false);
    }
  };

  const handleNewUserAuth = async () => {
    if (!address || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!displayName || displayName.trim().length < 2) {
      setError("Please enter a valid name (at least 2 characters)");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Get fresh nonce
      const nonceResponse = await api.getNonce({ walletAddress: address });
      
      if (!nonceResponse.success || !nonceResponse.data) {
        throw new Error(nonceResponse.error || "Failed to get nonce");
      }

      const { nonce, message } = nonceResponse.data;
      const timestamp = Date.now();

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Verify with display name
      const verifyResponse = await api.verifyWalletSignature({
        walletAddress: address,
        signature,
        nonce,
        timestamp,
        displayName: displayName.trim(),
      });

      if (verifyResponse.success && verifyResponse.data) {
        const { user, token } = verifyResponse.data;
        setWalletAuth(user, token, address);
        navigate("/app/dashboard?welcome=true");
      } else {
        throw new Error(verifyResponse.error || "Authentication failed");
      }
    } catch (err: any) {
      console.error("New user authentication error:", err);
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  if (showNameInput) {
    return (
      <GlassCard className="w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent mb-2">
            Welcome to RobozTrade!
          </h2>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary">
            Please enter your name to complete registration
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
              Your Name
            </label>
            <GlassInput
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Enter your name"
              disabled={loading}
            />
          </div>

          <GlassButton
            onClick={handleNewUserAuth}
            disabled={loading || !displayName.trim()}
            variant="primary"
            className="w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Complete Registration
              </>
            )}
          </GlassButton>

          <button
            onClick={() => {
              setShowNameInput(false);
              setDisplayName("");
              setError("");
            }}
            className="w-full text-sm text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary transition-colors"
            disabled={loading}
          >
            Back
          </button>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full max-w-md">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent mb-2">
          Connect Your Wallet
        </h2>
        <p className="text-light-text-tertiary dark:text-dark-text-tertiary">
          Sign in securely with your Web3 wallet
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {!isConnected ? (
        <div className="space-y-4">
          <GlassButton
            onClick={() => open()}
            variant="primary"
            className="w-full flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </GlassButton>

          <div className="p-4 bg-light-bg-tertiary dark:bg-dark-bg-tertiary rounded-lg">
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
              <strong className="text-light-text-primary dark:text-dark-text-primary">
                Why wallet authentication?
              </strong>
            </p>
            <ul className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary mt-2 space-y-1 list-disc list-inside">
              <li>No passwords to remember</li>
              <li>Secure cryptographic signatures</li>
              <li>Full control of your identity</li>
              <li>Seamless Web3 integration</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-light-bg-tertiary dark:bg-dark-bg-tertiary rounded-lg">
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-1">
              Connected Wallet
            </p>
            <p className="font-mono text-sm text-light-text-primary dark:text-dark-text-primary">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
          </div>

          <GlassButton
            onClick={handleWalletAuth}
            disabled={loading}
            variant="primary"
            className="w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Sign Message to Continue
              </>
            )}
          </GlassButton>

          <p className="text-xs text-center text-light-text-tertiary dark:text-dark-text-tertiary">
            You'll be asked to sign a message to verify wallet ownership.
            This is free and doesn't require any gas fees.
          </p>
        </div>
      )}
    </GlassCard>
  );
}

