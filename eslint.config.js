import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", ".venv/**", "client/postcss.config.cjs"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/src/**/*.{ts,tsx}"],
    ...reactHooks.configs["recommended-latest"],
    plugins: { "react-refresh": reactRefresh },
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
);
