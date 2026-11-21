import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run dev runner expects the dev server strictly on port 3000
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Explicit static handlers for public assets and icon fallbacks
app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/assets', express.static(path.resolve(__dirname, 'public', 'assets')));

// Direct fallbacks for logo and shortcut icon requests from any relative subpath
app.get(['*/OTERIOlogo_549a0e32.jpg', '*/assets/aistudio/OTERIOlogo_549a0e32.jpg'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'assets', 'aistudio', 'OTERIOlogo_549a0e32.jpg'));
});

app.get(['*/IMG_20261118_203457_9dc5212b.jpg', '*/assets/aistudio/IMG_20261118_203457_9dc5212b.jpg'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'assets', 'aistudio', 'IMG_20261118_203457_9dc5212b.jpg'));
});

app.get(['*/operio_icon.png', '*/assets/aistudio/operio_icon.png'], (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'operio_icon.png'));
});

app.get('*/apple-touch-icon.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'apple-touch-icon.png'));
});

app.get('*/pwa-192x192.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pwa-192x192.png'));
});

app.get('*/pwa-512x512.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pwa-512x512.png'));
});

app.get('*/pwa-maskable-512x512.png', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'pwa-maskable-512x512.png'));
});

// Transparent internal rewrite for /main.tsx to /src/main.tsx (no 302 redirect)
app.use((req, _res, next) => {
  if (req.path === '/main.tsx' || req.path === '/main.js') {
    req.url = req.url.replace(/^\/main\.(tsx|js)/, '/src/main.tsx');
  }
  next();
});

// Vite Middleware for development or static build for production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`OPERIO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
