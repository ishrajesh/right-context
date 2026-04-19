import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { appendFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = resolve(__dirname, '.errors.log');

function errorLogPlugin(): Plugin {
  return {
    name: 'error-log',
    configureServer(server) {
      // Make sure the file exists so users/devs can tail it
      if (!existsSync(LOG_PATH)) writeFileSync(LOG_PATH, '');

      server.middlewares.use('/__log', (req, res) => {
        if (req.method === 'DELETE') {
          writeFileSync(LOG_PATH, '');
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c as Buffer));
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          const ts = new Date().toISOString();
          try {
            const parsed = JSON.parse(body);
            appendFileSync(
              LOG_PATH,
              `[${ts}] ${parsed.type || 'log'}: ${
                parsed.message || parsed.reason || ''
              }\n${parsed.stack ? parsed.stack + '\n' : ''}${
                parsed.context ? 'CONTEXT ' + JSON.stringify(parsed.context) + '\n' : ''
              }---\n`
            );
          } catch {
            appendFileSync(LOG_PATH, `[${ts}] raw: ${body}\n---\n`);
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), errorLogPlugin()],
  server: { port: 5173 },
});
