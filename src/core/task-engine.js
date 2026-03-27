'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const engine = require('./engine');

const TASKS_DIR = path.join(process.cwd(), 'tasks');

// ── Schema Validation ──────────────────────────────────────────────────────

const REQUIRED_TASK_FIELDS = ['name', 'description', 'service', 'steps'];
const REQUIRED_STEP_FIELDS = ['id', 'action'];

function validateSchema(taskObj) {
  const errors = [];

  for (const f of REQUIRED_TASK_FIELDS) {
    if (!taskObj[f]) errors.push(`Thieu truong task: "${f}"`);
  }

  if (taskObj.steps && Array.isArray(taskObj.steps)) {
    taskObj.steps.forEach((step, i) => {
      for (const f of REQUIRED_STEP_FIELDS) {
        if (!step[f]) errors.push(`Step[${i}] thieu truong: "${f}"`);
      }
      if (step.type && !['sequential', 'parallel'].includes(step.type)) {
        errors.push(`Step[${i}].type phai la 'sequential' hoac 'parallel'`);
      }
      if (step.on_error) {
        const oe = step.on_error;
        if (!['stop', 'continue'].includes(oe) && !oe.startsWith('retry:')) {
          errors.push(`Step[${i}].on_error phai la 'stop', 'continue', hoac 'retry:N'`);
        }
      }
    });
  }

  return errors;
}

// ── Context Resolution ─────────────────────────────────────────────────────

function resolveContext(value, context) {
  if (typeof value !== 'string') return value;

  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
    const parts = expr.trim().split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined) break;

      // Handle array indexing: data[0]
      const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrMatch) {
        current = current[arrMatch[1]];
        current = Array.isArray(current) ? current[parseInt(arrMatch[2])] : undefined;
      } else {
        current = current[part];
      }
    }

    if (current === undefined || current === null) {
      throw new Error(`Context reference '${expr.trim()}' khong co gia tri`);
    }

    return typeof current === 'object' ? JSON.stringify(current) : String(current);
  });
}

function resolveParams(params, context) {
  if (!params) return {};
  const resolved = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') {
      resolved[k] = resolveContext(v, context);
    } else if (typeof v === 'object' && v !== null) {
      resolved[k] = resolveParams(v, context);
    } else {
      resolved[k] = v;
    }
  }
  return resolved;
}

// ── Task Loader ────────────────────────────────────────────────────────────

function load(taskName) {
  const taskFile = taskName.endsWith('.yaml') ? taskName : path.join(TASKS_DIR, `${taskName}.yaml`);

  if (!fs.existsSync(taskFile)) {
    const available = listTasks().join(', ') || 'khong co';
    throw new Error(`Task file '${taskFile}' khong ton tai. Co san: ${available}`);
  }

  let taskObj;
  try {
    taskObj = yaml.load(fs.readFileSync(taskFile, 'utf8'));
  } catch (err) {
    throw new Error(`Task YAML bi loi cu phap: ${err.message}`);
  }

  const errors = validateSchema(taskObj);
  if (errors.length > 0) {
    throw new Error(`Task file sai schema:\n  - ${errors.join('\n  - ')}`);
  }

  return taskObj;
}

function listTasks() {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));
}

// ── Step Executor ──────────────────────────────────────────────────────────

async function executeStep(step, profile, context, logger) {
  const startTime = Date.now();
  const retryMatch = (step.on_error || '').match(/^retry:(\d+)$/);
  const maxRetries = retryMatch ? parseInt(retryMatch[1]) : 0;

  let lastError = null;
  let attempt = 0;

  while (attempt <= maxRetries) {
    if (attempt > 0) {
      logger.warn(step.action, step.id, `Retry lan ${attempt}/${maxRetries}...`);
    }

    try {
      const resolvedParams = resolveParams(step.params || {}, context);
      const result = await engine.executeAction(
        profile._serviceName,
        step.action,
        resolvedParams,
        profile,
        logger
      );

      const duration_ms = Date.now() - startTime;
      return {
        id: step.id,
        status: result.success ? 'SUCCESS' : 'FAILED',
        duration_ms,
        output: result,
        message: result.message,
      };
    } catch (err) {
      lastError = err;
      attempt++;
      if (attempt > maxRetries) break;
    }
  }

  const duration_ms = Date.now() - startTime;
  return {
    id: step.id,
    status: 'FAILED',
    duration_ms,
    output: { success: false, data: null, message: lastError ? lastError.message : 'Unknown error' },
    message: lastError ? lastError.message : 'Unknown error',
  };
}

// ── Main Run ───────────────────────────────────────────────────────────────

async function run(taskObj, profile, logger) {
  const context = { steps: {} };
  const results = [];
  const startTime = Date.now();

  logger.info(profile._serviceName || 'system', 'task', `Bat dau task: ${taskObj.name}`);

  // Group steps: sequential runs one by one; consecutive parallel steps run together
  const groups = [];
  let i = 0;
  while (i < taskObj.steps.length) {
    const step = taskObj.steps[i];
    if (step.type === 'parallel') {
      const group = [];
      while (i < taskObj.steps.length && taskObj.steps[i].type === 'parallel') {
        group.push(taskObj.steps[i]);
        i++;
      }
      groups.push({ type: 'parallel', steps: group });
    } else {
      groups.push({ type: 'sequential', steps: [step] });
      i++;
    }
  }

  let shouldStop = false;

  for (const group of groups) {
    if (shouldStop) {
      for (const step of group.steps) {
        results.push({ id: step.id, status: 'SKIPPED', duration_ms: 0, message: 'Bi bo qua do step truoc that bai' });
      }
      continue;
    }

    if (group.type === 'parallel') {
      const parallelResults = await Promise.allSettled(
        group.steps.map(step => executeStep(step, profile, context, logger))
      );

      for (let j = 0; j < group.steps.length; j++) {
        const step = group.steps[j];
        const settled = parallelResults[j];
        const stepResult = settled.status === 'fulfilled'
          ? settled.value
          : { id: step.id, status: 'FAILED', duration_ms: 0, message: settled.reason && settled.reason.message };

        results.push(stepResult);
        context.steps[step.id] = { output: stepResult.output };

        if (stepResult.status === 'FAILED' && (!step.on_error || step.on_error === 'stop')) {
          logger.error(profile._serviceName, step.action, `Step '${step.id}' that bai (parallel), dung task.`);
          shouldStop = true;
        }
      }
    } else {
      const step = group.steps[0];
      const stepResult = await executeStep(step, profile, context, logger);
      results.push(stepResult);
      context.steps[step.id] = { output: stepResult.output };

      if (stepResult.status === 'FAILED') {
        const onError = step.on_error || 'stop';
        if (onError === 'stop' || onError.startsWith('retry:')) {
          logger.error(profile._serviceName, step.action, `Step '${step.id}' that bai, dung task.`);
          shouldStop = true;
        } else {
          logger.warn(profile._serviceName, step.action, `Step '${step.id}' that bai, tiep tuc (on_error=continue).`);
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const allSuccess = results.every(r => r.status === 'SUCCESS' || r.status === 'SKIPPED');

  logger.info(profile._serviceName || 'system', 'task',
    `Ket thuc task: ${taskObj.name} | ${allSuccess ? 'SUCCESS' : 'PARTIAL/FAILED'} | ${totalDuration}ms`);

  return { results, totalDuration, success: allSuccess, taskName: taskObj.name };
}

module.exports = { load, listTasks, run, validateSchema };
