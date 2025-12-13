import type { BuildOptions } from 'esbuild';

import { build, context } from 'esbuild';
import { htmlPlugin } from '@craftamap/esbuild-plugin-html';

/**
 * Process according to the value of
 * the NODE_ENV environment variable
 */
const isDev = process.env.NODE_ENV === 'development';

// Common settings for build or watch
const common: BuildOptions = {
  outdir: 'dist', // output destination
  bundle: true, // bundle, of course.
  minify: !isDev,
  sourcemap: isDev,
  define: {
    // Requires a type declaration file (later mention)
    DEBUG: isDev ? 'true' : 'false',
  },
};

// Configuration for main process
const main: BuildOptions = {
  // Import common settings
  ...common,
  // main process and preload script
  entryPoints: ['src/main.ts', 'src/preload.ts'],
  // Build for Node.js environment
  platform: 'node',
  // you will get run-time error without the following:
  external: ['electron'],
};

// Configuration for renderer process
const renderer: BuildOptions = {
  ...common,
  // Entry file for React app
  entryPoints: ['src/web/index.tsx'],
  // Build for Web
  platform: 'browser',
  // Required for htmlPlugin
  metafile: true,
  plugins: [
    htmlPlugin({
      files: [
        {
          entryPoints: ['src/web/index.tsx'],
          filename: 'index.html',
          htmlTemplate: 'src/web/index.html',
        },
      ],
    }),
  ],
};

// Function to execute during development
const watch = async () => {
  await (await context({ ...main })).watch();
  await (await context({ ...renderer })).watch();
};

// Function to execute during production build
const prod = async () => {
  build({ ...main });
  build({ ...renderer });
};

// Executing scripts
isDev ? watch() : prod();