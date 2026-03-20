import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/no-autofocus": "warn",
    },
  },
];
