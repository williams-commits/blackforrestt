import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** Minimal ESLint config extending Next.js defaults. */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "next-env.d.ts",
      "build/**",
      "dist/**",
      "artifacts/**",
      "e2e/node_modules/**",
      "crm/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The engine intentionally uses dynamic import + a couple of refs.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
