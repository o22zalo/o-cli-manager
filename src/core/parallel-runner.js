'use strict';

const ora = require('ora');

/**
 * Run multiple async tasks in parallel with progress spinner.
 * Returns array of { label, status, result, error, duration_ms }
 */
async function runParallel(tasks, spinnerText = 'Dang xu ly song song...') {
  const spinner = ora(spinnerText).start();
  const startTime = Date.now();

  const promises = tasks.map(async ({ label, fn }) => {
    const t0 = Date.now();
    try {
      const result = await fn();
      return { label, status: 'fulfilled', result, duration_ms: Date.now() - t0 };
    } catch (error) {
      return { label, status: 'rejected', error, duration_ms: Date.now() - t0 };
    }
  });

  const settled = await Promise.allSettled(promises);
  const totalMs = Date.now() - startTime;

  const results = settled.map(s => s.status === 'fulfilled' ? s.value : { label: '?', status: 'rejected', error: s.reason, duration_ms: 0 });

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const total = results.length;

  spinner.succeed(`Hoan thanh ${successCount}/${total} tasks trong ${totalMs}ms`);

  return results;
}

/**
 * Run a single async operation with a spinner
 */
async function withSpinner(text, fn) {
  const spinner = ora(text).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (err) {
    spinner.fail(`That bai: ${err.message}`);
    throw err;
  }
}

module.exports = { runParallel, withSpinner };
