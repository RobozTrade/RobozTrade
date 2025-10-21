import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { GlassCard, GlassButton, GlassInput } from "@/components/ui/GlassCard";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.register({ email, password, displayName });
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        navigate("/app/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

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

        <GlassCard className="p-8">
          <h2 className="text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-6">
            Create Account
          </h2>

          {error && (
            <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                Display Name
              </label>
              <GlassInput
                type="text"
                value={displayName}
                onChange={setDisplayName}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                Email
              </label>
              <GlassInput
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary mb-2">
                Password
              </label>
              <GlassInput
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
              <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
                Minimum 8 characters
              </p>
            </div>

            <GlassButton
              type="submit"
              disabled={loading}
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {loading ? "Creating account..." : "Create Account"}
            </GlassButton>
          </form>

          <div className="mt-6 text-center">
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-accent-blue hover:underline font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
