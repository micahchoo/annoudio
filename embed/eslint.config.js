import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/", ".cache/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        window: "readonly", document: "readonly", console: "readonly", location: "readonly",
        customElements: "readonly", HTMLElement: "readonly", CustomEvent: "readonly", URL: "readonly",
        process: "readonly", setTimeout: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
