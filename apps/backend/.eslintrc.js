module.exports = {
  extends: ['../../.eslintrc.js'], // Extend the root config
  env: {
    node: true,
    jest: true, // <--- This is what fixes the red squiggles in .spec.ts files
  },
  rules: {
    // Backend specific rules
    '@typescript-eslint/interface-name-prefix': 'off',
  },
};