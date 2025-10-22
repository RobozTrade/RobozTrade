import { Activity } from "lucide-react";
import { WalletAuth } from "@/components/auth/WalletAuth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg-secondary dark:bg-dark-bg-primary p-4 transition-colors duration-300">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple">
              <Activity className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent mb-2">
            RobozTrade
          </h1>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary">
            AI Trading Platform
          </p>
        </div>

        <WalletAuth />
      </div>
    </div>
  );
}
