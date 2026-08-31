module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'dist/', 'dist-proto/', 'web-build/', '.expo/'],
  rules: {
    'no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
  },
};