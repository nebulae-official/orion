import jsxA11y from "eslint-plugin-jsx-a11y";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    plugins: {
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
    },
  },
];
