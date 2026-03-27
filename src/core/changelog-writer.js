'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();

function prependToFile(fp, content) {
  let existing = '';
  if (fs.existsSync(fp)) {
    existing = fs.readFileSync(fp, 'utf8');
  }
  fs.writeFileSync(fp, content + existing, 'utf8');
}

/**
 * Write protocol files after a task run
 * @param {Object} opts
 * @param {string}   opts.task        - Task name
 * @param {string}   opts.service     - Service name
 * @param {string}   opts.profile     - Profile name
 * @param {Array}    opts.results     - Array of step results
 * @param {string}   opts.status      - 'SUCCESS' | 'PARTIAL' | 'FAILED'
 * @param {number}   opts.totalMs     - Total duration ms
 * @param {string}   [opts.description] - Task description
 */
function write(opts) {
  const {
    task        = 'unknown-task',
    service     = 'unknown-service',
    profile     = 'default',
    results     = [],
    status      = 'UNKNOWN',
    totalMs     = 0,
    description = '',
  } = opts;

  const now        = new Date();
  const dateStr    = now.toISOString().replace('T', ' ').substring(0, 19);
  const durationFmt = totalMs.toLocaleString() + 'ms';

  // Step summary string:  step_id ✅ | step_id2 ❌
  const stepSummary = results
    .map((r) => `${r.stepId || r.action || '?'} ${r.status === 'SUCCESS' ? '✅' : '❌'}`)
    .join(' | ');

  // ─── .opushforce.message (overwrite) ──────────────────────────────────────
  const opushMsg = [
    `[CLI Run] ${service} / ${task} @ ${dateStr}`,
    '',
    `Steps executed: ${stepSummary || '(none)'}`,
    `Profile: ${profile} | Duration: ${durationFmt} | Status: ${status}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, '.opushforce.message'), opushMsg, 'utf8');

  // ─── CHANGE_LOGS.md (prepend) ─────────────────────────────────────────────
  const changeLogEntry = [
    `## [${dateStr}] ${service} — ${task}`,
    '',
    `- **Service**: ${service}`,
    `- **Task**: ${task}`,
    `- **Profile**: ${profile}`,
    `- **Steps**: ${stepSummary || '(none)'}`,
    `- **Duration**: ${durationFmt}`,
    `- **Status**: ${status}`,
    '',
    '---',
    '',
  ].join('\n');
  prependToFile(path.join(ROOT, 'CHANGE_LOGS.md'), changeLogEntry);

  // ─── CHANGE_LOGS_USER.md (prepend) ────────────────────────────────────────
  const successSteps = results.filter((r) => r.status === 'SUCCESS');
  const userDesc     = description || `Thực hiện task '${task}' trên ${service}`;
  const userEntry = [
    `## [${dateStr}] ${userDesc}`,
    '',
    status === 'SUCCESS'
      ? `Đã thực hiện thành công ${successSteps.length}/${results.length} bước trên dịch vụ ${service} với profile '${profile}'.`
      : `Thực hiện ${successSteps.length}/${results.length} bước thành công. Trạng thái: ${status}.`,
    '',
    '---',
    '',
  ].join('\n');
  prependToFile(path.join(ROOT, 'CHANGE_LOGS_USER.md'), userEntry);
}

module.exports = { write };
