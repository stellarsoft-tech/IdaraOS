import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow unused variables that start with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Allow explicit any in some cases (warn instead of error)
      "@typescript-eslint/no-explicit-any": "warn",
      // Prefer const over let when variable is not reassigned
      "prefer-const": "warn",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "drizzle/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];

export default eslintConfig;
