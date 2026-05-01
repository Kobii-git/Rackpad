export default [
  {
    ignores: [
      'dist/**',
      'dist-server/**',
      'node_modules/**',
      '.tsbuild/**',
      '*.tsbuildinfo',
      'rackpad.db*',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {},
  },
]
