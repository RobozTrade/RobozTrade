import { Wrench, Clock, Mail } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg-secondary dark:bg-dark-bg-primary p-4 transition-colors duration-300">
      <div className="w-full max-w-2xl">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <img
              src="/logo-text.png"
              alt="RobozTrade"
              className="h-16 sm:h-20 object-contain"
            />
          </div>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary text-lg">
            AI Trading Platform
          </p>
        </div>

        {/* Main Maintenance Card */}
        <GlassCard className="p-8 sm:p-12 mb-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent-blue/10 dark:bg-accent-blue/20 mb-6">
              <Wrench className="w-10 h-10 text-accent-blue" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-light-text-primary dark:text-dark-text-primary mb-4">
              Under Maintenance
            </h2>
            <p className="text-lg text-light-text-secondary dark:text-dark-text-secondary max-w-md mx-auto">
              We're currently performing scheduled maintenance to improve your
              trading experience.
            </p>
          </div>

          {/* Status Information */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-light-bg-primary/50 dark:bg-dark-bg-secondary/50 border border-light-border/50 dark:border-dark-border/50">
              <div className="p-2 rounded-lg bg-accent-blue/10 dark:bg-accent-blue/20">
                <Clock className="w-5 h-5 text-accent-blue" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
                  Expected Duration
                </h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  We expect to be back online within 2-4 hours
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-light-bg-primary/50 dark:bg-dark-bg-secondary/50 border border-light-border/50 dark:border-dark-border/50">
              <div className="p-2 rounded-lg bg-accent-purple/10 dark:bg-accent-purple/20">
                <Mail className="w-5 h-5 text-accent-purple" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-light-text-primary dark:text-dark-text-primary mb-1">
                  Stay Updated
                </h3>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                  Follow us on social media for real-time updates
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
            Thank you for your patience. We'll be back soon!
          </p>
        </div>
      </div>
    </div>
  );
}
