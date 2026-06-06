import type { Config } from "tailwindcss";

// Black Thunder brand system (per AGENT.md + official assets / blackathon site):
//   Thunder Yellow RGB(255,211,0) #FFD300, Thunder Red RGB(230,0,18) #E60012,
//   near-black base, chocolate browns. The "ザクザク" (crunchy) motion language
//   lives in the keyframes below.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        thunder: {
          yellow: "#FFD300",
          "yellow-deep": "#F5B800",
          red: "#E60012",
          black: "#0A0A0A",
          ink: "#161310",
          white: "#FFFFFF",
        },
        choco: {
          DEFAULT: "#3A241A",
          light: "#5A3A28",
          dark: "#241008",
        },
      },
      fontFamily: {
        // Wired up via next/font in app/layout.tsx (CSS variables).
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        thunder: "0 0 0 3px #0A0A0A, 0 8px 0 0 #0A0A0A, 0 14px 28px rgba(0,0,0,0.45)",
        "thunder-yellow": "0 0 24px rgba(255,211,0,0.45)",
      },
      backgroundImage: {
        "thunder-radial":
          "radial-gradient(1200px 600px at 50% -10%, rgba(255,211,0,0.18), transparent 60%)",
        "choco-noise":
          "repeating-radial-gradient(circle at 30% 30%, rgba(90,58,40,0.25) 0 2px, transparent 2px 6px)",
      },
      keyframes: {
        // crispy shimmer on the live score
        zakuzaku: {
          "0%,100%": { filter: "brightness(1)", transform: "translateY(0)" },
          "50%": { filter: "brightness(1.25)", transform: "translateY(-1px) skewX(-2deg)" },
        },
        // reward pop when a score / count increases
        crunchPop: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.18) rotate(-1deg)" },
          "100%": { transform: "scale(1)" },
        },
        thunderFlash: {
          "0%,100%": { opacity: "0" },
          "8%": { opacity: "0.7" },
          "16%": { opacity: "0" },
        },
        boltDrop: {
          "0%": { transform: "translateY(-120%) rotate(8deg)", opacity: "0" },
          "60%": { opacity: "1" },
          "100%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
        },
        rainBolt: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(40deg)", opacity: "0" },
        },
        // rank improvement: a quick lift + yellow flash
        rankUp: {
          "0%": { transform: "translateY(10px)", filter: "brightness(1)" },
          "30%": { transform: "translateY(-4px)", filter: "brightness(1.5)" },
          "100%": { transform: "translateY(0)", filter: "brightness(1)" },
        },
        // rank drop: a small settle
        rankDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0.6" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        zakuzaku: "zakuzaku 1.6s ease-in-out infinite",
        crunchPop: "crunchPop 0.45s ease-out",
        thunderFlash: "thunderFlash 2.6s steps(1) infinite",
        boltDrop: "boltDrop 0.6s cubic-bezier(0.2,0.8,0.2,1) both",
        rainBolt: "rainBolt 2.4s linear infinite",
        rankUp: "rankUp 0.6s cubic-bezier(0.2,0.8,0.2,1) both",
        rankDown: "rankDown 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
