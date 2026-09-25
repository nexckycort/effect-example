await Bun.build({
  entrypoints: ['./src/main.ts'],
  compile: {
    outfile: './dist/server',
  },
  minify: true,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
