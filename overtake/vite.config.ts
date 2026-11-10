import { defineConfig, type UserConfig } from 'vite';

const common: UserConfig = {
  server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
};

export default defineConfig(({ mode }): UserConfig => {
  if (mode === 'portal') {
    // CrazyGames submission: the game is index.html at the zip root and every
    // asset URL must be relative so it works on a shared CDN path.
    return {
      ...common,
      base: './',
      build: {
        target: 'es2022',
        outDir: 'dist-crazygames',
        emptyOutDir: true,
        chunkSizeWarningLimit: 900,
        rollupOptions: { input: { play: 'play.html' } },
      },
    };
  }
  return {
    ...common,
    build: { target: 'es2022', chunkSizeWarningLimit: 900, rollupOptions: { input: { home: 'index.html', play: 'play.html' } } },
  };
});
