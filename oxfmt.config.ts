import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,

  semi: false,
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'es5',

  endOfLine: 'lf',
  insertFinalNewline: true,

  sortImports: {
    newlinesBetween: false,
  },

  ignorePatterns: ['dist/', 'pnpm-lock.yaml'],
})
