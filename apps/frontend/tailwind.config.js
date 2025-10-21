/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light mode colors
        light: {
          bg: {
            primary: "#ffffff",
            secondary: "#f5f5f7",
            tertiary: "#e8e8ed",
          },
          text: {
            primary: "#1d1d1f",
            secondary: "#6e6e73",
            tertiary: "#86868b",
          },
          border: "#d2d2d7",
        },
        // Dark mode colors
        dark: {
          bg: {
            primary: "#000000",
            secondary: "#1c1c1e",
            tertiary: "#2c2c2e",
          },
          text: {
            primary: "#f5f5f7",
            secondary: "#98989d",
            tertiary: "#636366",
          },
          border: "#38383a",
        },
        // Accent colors (work in both modes)
        accent: {
          blue: {
            DEFAULT: "#007aff",
            light: "#5ac8fa",
            dark: "#0a84ff",
          },
          purple: {
            DEFAULT: "#af52de",
            light: "#bf5af2",
            dark: "#bf5af2",
          },
          pink: {
            DEFAULT: "#ff2d55",
            light: "#ff375f",
            dark: "#ff375f",
          },
          green: {
            DEFAULT: "#34c759",
            light: "#30d158",
            dark: "#30d158",
          },
          red: {
            DEFAULT: "#ff3b30",
            light: "#ff453a",
            dark: "#ff453a",
          },
          orange: {
            DEFAULT: "#ff9500",
            light: "#ff9f0a",
            dark: "#ff9f0a",
          },
        },
        // Legacy colors for compatibility
        primary: {
          DEFAULT: "#007aff",
          hover: "#0051d5",
          light: "#5ac8fa",
        },
        success: {
          DEFAULT: "#34c759",
          hover: "#248a3d",
          light: "#30d158",
        },
        danger: {
          DEFAULT: "#ff3b30",
          hover: "#d70015",
          light: "#ff453a",
        },
        warning: {
          DEFAULT: "#ff9500",
          hover: "#c93400",
          light: "#ff9f0a",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["SF Mono", "Monaco", "Inconsolata", "Fira Code", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
        "3xl": "64px",
        "4xl": "128px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
        "glass-lg": "0 16px 48px 0 rgba(0, 0, 0, 0.15)",
        "glass-xl": "0 24px 64px 0 rgba(0, 0, 0, 0.2)",
        "inner-glass": "inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
        glow: "0 0 20px rgba(0, 122, 255, 0.3)",
        "glow-success": "0 0 20px rgba(52, 199, 89, 0.3)",
        "glow-danger": "0 0 20px rgba(255, 59, 48, 0.3)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
    },
  },
  plugins: [],
};
