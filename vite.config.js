const { defineConfig } = require('vite');
const fs = require('node:fs');
const path = require('node:path');

// The studio loads these plain scripts and the problem files at run time, so the build output needs them next to new.html.
const STUDIO_RUNTIME_FILES = ['studio-catalog.js', 'studio-core.js', 'curriculum'];
const copyStudioRuntimeFiles = {
  name: 'copy-studio-runtime-files',
  apply: 'build',
  closeBundle() {
    for (const name of STUDIO_RUNTIME_FILES) {
      fs.cpSync(path.join(__dirname, 'public', name), path.join(__dirname, 'dist-new', name), { recursive: true });
    }
  },
};

// new.html lives in public/ so the legacy Node server can keep serving the rest of the site.
module.exports = defineConfig({
  root: path.join(__dirname, 'public'),
  publicDir: false,
  plugins: [copyStudioRuntimeFiles],
  server: { host: '127.0.0.1', port: 5173, open: '/new.html' },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    outDir: path.join(__dirname, 'dist-new'),
    emptyOutDir: true,
    rollupOptions: { input: path.join(__dirname, 'public', 'new.html') },
  },
});
