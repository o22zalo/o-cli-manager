'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const STATE_DIR  = path.join(process.cwd(), 'state');
const STATE_FILE = path.join(STATE_DIR, 'session.yaml');

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readState() {
  ensureStateDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { last_updated: new Date().toISOString(), services: {} };
  }
  try {
    const raw = yaml.load(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('Corrupt');
    return raw;
  } catch (err) {
    console.warn(`[WARN] session.yaml bi corrupt, tao lai. Chi tiet: ${err.message}`);
    const fresh = { last_updated: new Date().toISOString(), services: {} };
    writeState(fresh);
    return fresh;
  }
}

function writeState(state) {
  ensureStateDir();
  state.last_updated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, yaml.dump(state, { indent: 2 }), 'utf8');
}

function setLastUsed(serviceName, key, value) {
  const state = readState();
  if (!state.services) state.services = {};
  if (!state.services[serviceName]) state.services[serviceName] = {};
  state.services[serviceName][key] = value;
  state.services[serviceName].last_run_at = new Date().toISOString();
  writeState(state);
}

function getLastUsed(serviceName, key) {
  const state = readState();
  return (state.services && state.services[serviceName] && state.services[serviceName][key]) || null;
}

function getServiceState(serviceName) {
  const state = readState();
  return (state.services && state.services[serviceName]) || {};
}

function setServiceState(serviceName, updates) {
  const state = readState();
  if (!state.services) state.services = {};
  state.services[serviceName] = { ...(state.services[serviceName] || {}), ...updates };
  writeState(state);
}

function getLastService() {
  const state = readState();
  if (!state.services) return null;
  // Find service with most recent last_run_at
  let latest = null;
  let latestTime = null;
  for (const [svc, data] of Object.entries(state.services)) {
    if (data.last_run_at && (!latestTime || data.last_run_at > latestTime)) {
      latestTime = data.last_run_at;
      latest = svc;
    }
  }
  return latest;
}

module.exports = {
  readState,
  writeState,
  setLastUsed,
  getLastUsed,
  getServiceState,
  setServiceState,
  getLastService,
};
