import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
/** @type {import('vite').UserConfig} */
export default defineConfig({
    base: '/basra-game/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'assets/skins/cards/card_back_darnes.png'],
            manifest: {
                name: 'Basra Club - لعبة البصرة',
                short_name: 'Basra',
                description: 'لعبة البصرة الليبية الأصلية بتصميم عصري وأندية محلية',
                theme_color: '#151008',
                background_color: '#151008',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'assets/skins/cards/card_back_darnes.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'assets/skins/cards/card_back_darnes.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            }
        })
    ],
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
    }
});
