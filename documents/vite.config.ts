import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'
import proxyOptions from './proxyOptions';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 8080,
		proxy: proxyOptions
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'@components': path.resolve(__dirname, 'src/components'),
			'@lib': path.resolve(__dirname, 'src/lib'),
			'@hooks': path.resolve(__dirname, 'src/hooks'),
			'@pages': path.resolve(__dirname, 'src/pages'),
			'@types': path.resolve(__dirname, 'src/types'),
			'@providers': path.resolve(__dirname, 'src/providers'),
			'@config': path.resolve(__dirname, 'src/config'),
		}
	},
	build: {
		outDir: '../pdf_forms/public/documents',
		emptyOutDir: true,
		target: 'es2015',
	},
});
