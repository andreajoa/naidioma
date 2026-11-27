import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { buildServer } from './server.js';
import { pushDatabaseToCloudflare } from './services/cloud-sync.js';

async function main() {
  const app = await buildServer();

  const shutdown = async () => {
    try {
      await pushDatabaseToCloudflare();
    } catch {
      // best-effort flush before container stop
    }
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await app.listen({ port: config.port, host: config.host });
  console.log(`NAidioma API running on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error('Failed to start NAidioma API:', err);
  process.exit(1);
});
