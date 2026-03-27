'use strict';

const winston = require('winston');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

// ─── Sensitive field masking ─────────────────────────────────────────────────
const SENSITIVE_KEYS = ['token', 'key', 'password', 'secret', 'apikey', 'accesstoken', 'access_token', 'api_key'];

function maskSensitive(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitive);

  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase().replace(/[_-]/g, '');
    const isSensitive = SENSITIVE_KEYS.some((sk) => keyLower.includes(sk));
    result[k] = isSensitive ? '***' : maskSensitive(v);
  }
  return result;
}

function maskString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\b[A-Za-z0-9_-]{20,}\b/g, (m) => m.substring(0, 4) + '***');
}

// ─── Log directory setup ─────────────────────────────────────────────────────
const LOG_DIR = path.resolve(process.cwd(), 'logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

// ─── Colour map ──────────────────────────────────────────────────────────────
const LEVEL_COLORS = {
  info:    (s) => chalk.cyan(s),
  success: (s) => chalk.green(s),
  warn:    (s) => chalk.yellow(s),
  error:   (s) => chalk.red(s),
  debug:   (s) => chalk.gray(s),
};

const LEVEL_LABELS = {
  info:    'INFO   ',
  success: 'SUCCESS',
  warn:    'WARN   ',
  error:   'ERROR  ',
  debug:   'DEBUG  ',
};

// ─── Format helpers ───────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function formatConsole(level, service, action, message, meta) {
  const color = LEVEL_COLORS[level] || ((s) => s);
  const label = LEVEL_LABELS[level] || level.toUpperCase().padEnd(7);
  const maskedMeta = meta ? maskSensitive(meta) : null;
  const metaPart = (maskedMeta && Object.keys(maskedMeta).length)
    ? ' | ' + JSON.stringify(maskedMeta)
    : '';
  return color(`${ts()} | ${label} | ${service} | ${action} | ${message}${metaPart}`);
}

function formatFileLine(level, service, action, status, durationMs, detail) {
  const levelLabel  = level.toUpperCase().padEnd(7);
  const svcLabel    = String(service).padEnd(12);
  const actLabel    = String(action).padEnd(20);
  const stLabel     = String(status).padEnd(8);
  const parts = [`${ts()}`, levelLabel, svcLabel, actLabel, stLabel];
  if (durationMs != null) parts.push(`duration=${durationMs}ms`);
  if (detail) parts.push(String(detail));
  return parts.join(' | ');
}

// ─── Winston file logger cache ───────────────────────────────────────────────
const _cache = {};

function getFileLogger(service) {
  if (_cache[service]) return _cache[service];
  ensureLogDir();
  const date    = new Date().toISOString().substring(0, 10);
  const logFile = path.join(LOG_DIR, `${date}-${service}.log`);
  const fl = winston.createLogger({
    level: 'debug',
    transports: [
      new winston.transports.File({
        filename: logFile,
        format: winston.format.printf((info) => info.message),
      }),
    ],
  });
  _cache[service] = fl;
  return fl;
}

// ─── Core log function ────────────────────────────────────────────────────────
function log(level, service, action, message, meta) {
  console.log(formatConsole(level, service, action, message, meta));
  try {
    const fl     = getFileLogger(service);
    const masked = meta ? maskSensitive(meta) : null;
    const detail = (masked && Object.keys(masked).length) ? JSON.stringify(masked) : message;
    fl.log({ level: level === 'success' ? 'info' : level, message: formatFileLine(level, service, action, message, null, detail) });
  } catch (e) {
    console.error(chalk.red('[LOGGER ERROR]'), e.message);
  }
}

function logResult(level, service, action, status, durationMs, detail) {
  const color = LEVEL_COLORS[level] || ((s) => s);
  const label = LEVEL_LABELS[level] || level.toUpperCase().padEnd(7);
  const maskedDetail = typeof detail === 'string' ? maskString(detail) : JSON.stringify(maskSensitive(detail || {}));
  console.log(color(`${ts()} | ${label} | ${service} | ${action} | ${status} | duration=${durationMs}ms | ${maskedDetail}`));
  try {
    const fl = getFileLogger(service);
    fl.log({ level: level === 'success' ? 'info' : level, message: formatFileLine(level, service, action, status, durationMs, maskedDetail) });
  } catch (e) {
    console.error(chalk.red('[LOGGER ERROR]'), e.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
const logger = {
  info:       (service, action, message, meta) => log('info',    service, action, message, meta),
  success:    (service, action, message, meta) => log('success', service, action, message, meta),
  warn:       (service, action, message, meta) => log('warn',    service, action, message, meta),
  error:      (service, action, message, meta) => log('error',   service, action, message, meta),
  debug:      (service, action, message, meta) => log('debug',   service, action, message, meta),
  logResult,
  maskSensitive,
  maskString,
  startTimer: () => Date.now(),
  endTimer:   (start) => Date.now() - start,
};

module.exports = logger;
