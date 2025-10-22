import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className,
  hover = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        // Base glass effect
        "backdrop-blur-xl bg-white/10 dark:bg-black/10",
        "border border-white/20 dark:border-white/10",
        "rounded-2xl shadow-glass",
        // Transitions
        "transition-all duration-300",
        // Hover effect
        hover &&
          "hover:bg-white/15 dark:hover:bg-black/15 hover:shadow-glass-lg cursor-pointer",
        // Custom classes
        className
      )}
    >
      {children}
    </div>
  );
}

interface GlassButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function GlassButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className,
  disabled = false,
  type = "button",
}: GlassButtonProps) {
  const variants = {
    primary:
      "bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue border-accent-blue/30",
    secondary:
      "bg-white/10 hover:bg-white/20 dark:bg-black/10 dark:hover:bg-black/20 text-light-text-primary dark:text-dark-text-primary border-white/20 dark:border-white/10",
    danger:
      "bg-accent-red/20 hover:bg-accent-red/30 text-accent-red border-accent-red/30",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Base styles
        "backdrop-blur-xl border rounded-xl font-medium",
        "transition-all duration-200",
        "shadow-glass hover:shadow-glass-lg",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        // Variant and size
        variants[variant],
        sizes[size],
        // Custom classes
        className
      )}
    >
      {children}
    </button>
  );
}

interface GlassInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  disabled?: boolean;
}

export function GlassInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
  disabled = false,
}: GlassInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        // Base glass effect
        "backdrop-blur-xl bg-white/10 dark:bg-black/10",
        "border border-white/20 dark:border-white/10",
        "rounded-xl px-4 py-2",
        // Text
        "text-light-text-primary dark:text-dark-text-primary",
        "placeholder:text-light-text-tertiary dark:placeholder:text-dark-text-tertiary",
        // Focus
        "focus:outline-none focus:ring-2 focus:ring-accent-blue/50",
        "transition-all duration-200",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
        // Custom classes
        className
      )}
    />
  );
}
