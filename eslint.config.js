// ESLint checks the code for common mistakes: unused variables, typos in names, and so on.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  { files: ["app.js", "js/**/*.js"], languageOptions: { globals: globals.browser } },
  { files: ["sw.js"], languageOptions: { sourceType: "script", globals: globals.serviceworker } },
  { files: ["tests/**/*.js", "eslint.config.js"], languageOptions: { globals: globals.node } },
];
