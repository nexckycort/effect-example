import { defineConfig } from 'oxfmt';

export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',
  insertFinalNewline: true,

  singleQuote: true,

  // Imports
  sortImports: true,
});
