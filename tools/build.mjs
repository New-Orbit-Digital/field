// Build: bundles src/main.js -> dist/field.js, plus a single-file dist/field.html.
// `--serve` runs a dev server with rebuild on change at http://localhost:8000
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const serve = process.argv.includes('--serve');
const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/field.js',
  minify: !serve,
  sourcemap: serve,
  target: 'es2020',
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: '.', port: 8000 });
  console.log(`FIELD dev server: http://localhost:${port}/`);
} else {
  mkdirSync('dist', { recursive: true });
  await esbuild.build(opts);
  const js = readFileSync('dist/field.js', 'utf8').replace(/<\/script/g, '<\\/script');
  const css = readFileSync('src/ui/styles.css', 'utf8');
  const html = readFileSync('index.html', 'utf8')
    .replace('<link rel="stylesheet" href="./src/ui/styles.css">', () => `<style>\n${css}</style>`)
    .replace('<script type="module" src="./dist/field.js"></script>', () => `<script type="module">\n${js}\n</script>`);
  writeFileSync('dist/field.html', html);
  console.log(`dist/field.html ${(html.length / 1024).toFixed(0)} KB (single file, playable offline)`);
}
