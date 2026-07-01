import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
  build: {
    // The PDF export stack (jsPDF + html2canvas + canvg) is irreducibly large but
    // is lazy-loaded into its own on-demand chunk, so a higher limit is appropriate.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (
            id.includes('jspdf') || id.includes('/fflate') || id.includes('html2canvas') ||
            id.includes('/canvg') || id.includes('dompurify') || id.includes('rgbcolor') ||
            id.includes('stackblur') || id.includes('svg-pathdata') || id.includes('/raf/')
          ) return 'vendor-pdf';
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor') || id.includes('/lodash') || id.includes('react-smooth')) return 'vendor-charts';
          if (id.includes('/motion') || id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('@base-ui') || id.includes('@floating-ui')) return 'vendor-ui';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
});
