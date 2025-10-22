import {
  Wallet,
  LogOut,
  User,
  Loader2,
  LayoutDashboard,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDisconnect } from "wagmi";
import { useAuthStore } from "@/stores/authStore";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { GlassButton, GlassInput } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";

export function NavbarWalletAuth() {
  const { user, token, logout } = useAuthStore();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const {
    isConnected,
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
  } = useWalletAuth();

  // Helper to truncate wallet address
  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Handle logout with wallet disconnect
  const handleLogout = () => {
    logout();
    disconnect();
  };

  // Navigate to dashboard
  const goToDashboard = () => {
    navigate("/app/dashboard");
  };

  // If user is authenticated, show user info and logout
  if (token && user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
          <User className="w-4 h-4" />
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
              {user.displayName}
            </span>
            {user.walletAddress && (
              <span className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                {truncateAddress(user.walletAddress)}
              </span>
            )}
          </div>
        </div>
        <GlassButton onClick={goToDashboard} variant="primary" size="sm">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </div>
        </GlassButton>
        <GlassButton onClick={handleLogout} variant="secondary" size="sm">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </div>
        </GlassButton>
      </div>
    );
  }

  // If not authenticated, show connect/sign button
  return (
    <>
      <div className="flex items-center gap-3">
        {!isConnected ? (
          <GlassButton
            onClick={connectWallet}
            variant="primary"
            size="sm"
            disabled={loading}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </div>
          </GlassButton>
        ) : (
          <GlassButton
            onClick={authenticate}
            variant="primary"
            size="sm"
            disabled={loading}
          >
            <div className="flex items-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Sign Message</span>
                </>
              )}
            </div>
          </GlassButton>
        )}
      </div>

      {/* Name Input Modal for New Users */}
      <Modal
        isOpen={showNameInput}
        onClose={() => {
          setShowNameInput(false);
          clearError();
        }}
        title="Welcome to RobozTrade! 🎉"
        className="max-w-lg"
      >
        <div className="space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
              We need your name to complete your registration. You'll need to
              sign one more message to create your account.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl">
              <p className="text-sm text-red-500 text-center">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-light-text-primary dark:text-dark-text-primary mb-2">
              Your Name
            </label>
            <GlassInput
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Enter your full name"
              disabled={loading}
              className="text-base w-full"
            />
            <p className="mt-2 text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
              This name will be displayed on your profile
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <GlassButton
              onClick={() => {
                setShowNameInput(false);
                clearError();
              }}
              disabled={loading}
              variant="secondary"
              className="flex-1 flex items-center justify-center py-3"
            >
              Cancel
            </GlassButton>

            <GlassButton
              onClick={completeRegistration}
              disabled={
                loading || !displayName.trim() || displayName.trim().length < 2
              }
              variant="primary"
              className="flex-1 flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Complete
                </>
              )}
            </GlassButton>
          </div>
        </div>
      </Modal>

      {/* Error Toast */}
      {error && !showNameInput && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="backdrop-blur-xl bg-red-500/90 border border-red-500/20 rounded-xl px-4 py-3 shadow-lg max-w-md">
            <div className="flex items-start gap-3">
              <p className="text-sm text-white flex-1">{error}</p>
              <button
                onClick={clearError}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Import X icon
import { X } from "lucide-react";
