/**
 * Lint-staged configuration
 * Uses functions to properly handle TypeScript checking
 */
export default {
  // ESLint for all JS/TS files (receives file list)
  "apps/web/**/*.{js,jsx,ts,tsx}": ["pnpm --filter web exec eslint --fix"],
  
  // TypeScript check for TS files - ignores file arguments to check whole project
  // This runs tsc on the whole project when any .ts/.tsx file is staged
  "apps/web/**/*.{ts,tsx}": () => "pnpm run typecheck",
};
