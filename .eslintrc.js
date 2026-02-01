module.exports = {
  root: true, // This is crucial: it stops ESLint from looking higher up your drive
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // Turns off rules that conflict with Prettier
  ],
  rules: {
    // Put rules here that you want across the whole monorepo
  }
};