// Next.js 16 removed `next lint` and ships a native ESLint flat config.
// Import it directly — the FlatCompat/eslintrc bridge breaks with the v16 plugin
// ("Converting circular structure to JSON").
import next from "eslint-config-next";

const eslintConfig = [
  { ignores: [".next/**", "out/**", "next-env.d.ts", "node_modules/**"] },
  ...next,
  {
    rules: {
      // New in the Next 16 / react-hooks v6 toolchain. Fires on our standard
      // "initialize state from a Firestore subscription / sessionStorage inside
      // an effect" pattern (live leaderboard, profiles, auth). These are correct,
      // so keep the rule visible as a warning rather than a CI-failing error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
