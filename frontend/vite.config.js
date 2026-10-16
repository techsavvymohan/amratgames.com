import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

const googleTagManager = {
    name: 'google-tag-manager',
    apply: (_, { command, mode }) => command === 'build' && mode === 'production',
    transformIndexHtml: {
        order: 'pre',
        handler: () => [
            {
                tag: 'script',
                children: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MZ825NFC');`,
                injectTo: 'head-prepend',
            },
            {
                tag: 'noscript',
                children: '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MZ825NFC" height="0" width="0" style="display:none;visibility:hidden"></iframe>',
                injectTo: 'body-prepend',
            },
        ],
    },
}

export default defineConfig({
    plugins: [react(), googleTagManager],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        open: false,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/_api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/ws': {
                target: 'http://localhost:3001',
                ws: true,
            },
        },
    },
    esbuild: {
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    build: {
        outDir: 'dist',
        target: 'es2020',
        minify: 'esbuild',
        cssCodeSplit: true,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                            return 'vendor-react'
                        }
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons'
                        }
                        if (id.includes('radix-ui') || id.includes('@radix-ui')) {
                            return 'vendor-radix'
                        }
                        if (id.includes('antd') || id.includes('@ant-design')) {
                            return 'vendor-antd'
                        }
                        if (id.includes('matter-js')) {
                            return 'vendor-matter'
                        }
                        if (id.includes('chart.js')) {
                            return 'vendor-chart'
                        }
                    }
                }
            }
        }
    }
})
