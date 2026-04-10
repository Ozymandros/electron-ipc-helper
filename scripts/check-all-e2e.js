#!/usr/bin/env node
const { execSync } = require('child_process');

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

(async () => {
  try {
    run('pnpm run docker:mock:up');

    console.log('\nRunning integration tests (RUN_INTEGRATION=1)');
    run('pnpm run test:integration', { env: { ...process.env, RUN_INTEGRATION: '1' } });

    console.log('\nE2E checks passed.');
  } catch (err) {
    console.error('\nE2E checks failed:', err && err.message ? err.message : err);
    process.exit(err && err.status ? err.status : 1);
  } finally {
    try {
      run('pnpm run docker:mock:down');
    } catch (stopErr) {
      console.error('Failed to stop docker mock backend:', stopErr && stopErr.message ? stopErr.message : stopErr);
    }
  }
})();
