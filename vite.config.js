import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    base: '/basra-game/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [],
            manifest: {
                name: 'Basra Club - لعبة البصرة',
                short_name: 'Basra',
                description: 'لعبة البصرة الليبية الأصلية بتصميم عصري وأندية محلية',
                theme_color: '#151008',
                background_color: '#151008',
                display: 'standalone',
                orientation: 'portrait',
                start_url: './',
                scope: './',
                icons: [
                    {
                        src: './assets/skins/cards/card_back_darnes.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: './assets/skins/cards/card_back_darnes.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                globIgnores: ['**/node_modules/**/*'],
            }
        })
    ],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/database']
                }
            }
        },
        chunkSizeWarningLimit: 600
    }
});
