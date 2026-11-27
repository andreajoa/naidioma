import { restoreDatabaseFromCloudflare } from '../services/cloud-sync.js';

async function run() {
  try {
    const res = await restoreDatabaseFromCloudflare();
    console.log('[NAidioma CloudRestore]', JSON.stringify(res));
  } catch (err) {
    console.error('[NAidioma CloudRestore] Non-fatal restore error:', err);
  }
}

void run();
