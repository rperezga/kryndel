import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    // Excluir código compilado, legado archivado y paquete web (Next.js tiene su propio linter)
    ignores: ["packages/**/dist/**", "packages/**/legacy/**", "packages/web/**"],
  },
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Variables con prefijo _ son "intencionalmente no usadas" (destructuring, params de interfaz)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettierConfig,
];
