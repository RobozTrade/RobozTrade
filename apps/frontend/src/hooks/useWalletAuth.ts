import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

interface UseWalletAuthReturn {
  isConnected: boolean;
  address: string | undefined;
  loading: boolean;
  error: string;
  showNameInput: boolean;
  displayName: string;
  setDisplayName: (name: string) => void;
  setShowNameInput: (show: boolean) => void;
  connectWallet: () => void;
  authenticate: () => Promise<void>;
  completeRegistration: () => Promise<void>;
  clearError: () => void;
}

export function useWalletAuth(): UseWalletAuthReturn {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { signMessageAsync } = useSignMessage();
  const { setWalletAuth } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const connectWallet = () => {
    open();
  };

  const authenticate = async () => {
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
        throw new Error("Failed to get nonce");
      }

      const { nonce, message, timestamp } = nonceResponse.data;

      // Step 2: Sign the message
      const signature = await signMessageAsync({ message });

      // Step 3: Verify signature and authenticate
      const authResponse = await api.verifyWalletSignature({
        walletAddress: address,
        signature,
        nonce,
        timestamp,
      });

      // Step 4: Handle response
      if (authResponse.success && authResponse.data) {
        // Successful authentication
        if (authResponse.data.isNewUser) {
          // New user - show name input
          setShowNameInput(true);
        } else {
          // Existing user - complete authentication
          setWalletAuth(
            authResponse.data.user,
            authResponse.data.token,
            address
          );
          setShowNameInput(false);
        }
      } else if (authResponse.error?.includes("Display name required")) {
        // New user detected - show name input modal
        setShowNameInput(true);
        setError(""); // Clear any error since this is expected behavior
      } else {
        throw new Error(authResponse.error || "Authentication failed");
      }
    } catch (err: any) {
      console.error("Wallet authentication error:", err);

      // Check if this is the "Display name required" error for new users
      if (err.message?.includes("Display name required")) {
        setShowNameInput(true);
        setError(""); // Clear error since this is expected behavior for new users
      } else if (err.message?.includes("User rejected")) {
        setError("Signature request was rejected");
      } else {
        setError(err.message || "Authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async () => {
    if (!address || !isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Step 1: Get nonce from backend
      const nonceResponse = await api.getNonce({ walletAddress: address });

      if (!nonceResponse.success || !nonceResponse.data) {
        throw new Error("Failed to get nonce");
      }

      const { nonce, message, timestamp } = nonceResponse.data;

      // Step 2: Sign the message
      const signature = await signMessageAsync({ message });

      // Step 3: Verify signature and create account
      const authResponse = await api.verifyWalletSignature({
        walletAddress: address,
        signature,
        nonce,
        timestamp,
        displayName: displayName.trim(),
      });

      if (!authResponse.success || !authResponse.data) {
        throw new Error(authResponse.error || "Registration failed");
      }

      // Step 4: Complete authentication
      setWalletAuth(authResponse.data.user, authResponse.data.token, address);
      setShowNameInput(false);
      setDisplayName("");
    } catch (err: any) {
      console.error("Registration error:", err);

      if (err.message?.includes("User rejected")) {
        setError("Signature request was rejected");
      } else {
        setError(err.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError("");

  return {
    isConnected,
    address,
    loading,
    error,
    showNameInput,
    displayName,
    setDisplayName,
    setShowNameInput,
    connectWallet,
    authenticate,
    completeRegistration,
    clearError,
  };
}

