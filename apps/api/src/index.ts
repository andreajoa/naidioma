import { config } from './lib/config.js';
import { prisma } from './lib/prisma.js';
import { buildServer } from './server.js';

async function main() {
  const app = await buildServer();

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.port, host: config.host });
  console.log(`NAidioma API running on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error('Failed to start NAidioma API:', err);
  process.exit(1);
});
