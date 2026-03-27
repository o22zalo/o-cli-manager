'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIGS_DIR = path.join(process.cwd(), 'configs');

function getConfigPath(serviceName) {
  return path.join(CONFIGS_DIR, `${serviceName}.yaml`);
}

function readConfig(serviceName) {
  const configPath = getConfigPath(serviceName);
  if (!fs.existsSync(configPath)) return null;
  try {
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Loi doc config ${serviceName}: ${err.message}`);
  }
}

function writeConfig(serviceName, config) {
  if (!fs.existsSync(CONFIGS_DIR)) fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  const configPath = getConfigPath(serviceName);
  fs.writeFileSync(configPath, yaml.dump(config, { indent: 2 }), 'utf8');
}

function listProfiles(serviceName) {
  const config = readConfig(serviceName);
  if (!config || !config.profiles) return [];
  return config.profiles;
}

function getProfile(serviceName, profileName) {
  const config = readConfig(serviceName);
  if (!config || !config.profiles) return null;
  return config.profiles.find(p => p.name === profileName) || null;
}

function saveProfile(serviceName, profile) {
  if (!profile.name) throw new Error('Profile thieu truong "name"');

  let config = readConfig(serviceName) || { service: serviceName, last_used: {}, profiles: [] };
  if (!config.profiles) config.profiles = [];

  const idx = config.profiles.findIndex(p => p.name === profile.name);
  if (idx >= 0) {
    config.profiles[idx] = profile;
  } else {
    config.profiles.push(profile);
  }

  writeConfig(serviceName, config);
  return profile;
}

function deleteProfile(serviceName, profileName) {
  const config = readConfig(serviceName);
  if (!config || !config.profiles) throw new Error(`Khong tim thay config ${serviceName}`);

  const before = config.profiles.length;
  config.profiles = config.profiles.filter(p => p.name !== profileName);

  if (config.profiles.length === before) {
    throw new Error(`Profile '${profileName}' khong ton tai`);
  }

  writeConfig(serviceName, config);
}

function updateLastUsed(serviceName, updates) {
  const config = readConfig(serviceName);
  if (!config) return;
  config.last_used = { ...(config.last_used || {}), ...updates };
  writeConfig(serviceName, config);
}

/**
 * Validate required fields in a profile
 * @param {object} profile
 * @param {string[]} requiredFields - list of required field paths like ['credentials.accessToken']
 */
function validateProfile(profile, requiredFields = []) {
  const errors = [];
  for (const fieldPath of requiredFields) {
    const parts = fieldPath.split('.');
    let val = profile;
    for (const part of parts) {
      val = val && val[part];
    }
    if (val === undefined || val === null || val === '') {
      errors.push(`Thieu truong bat buoc: ${fieldPath}`);
    }
  }
  return errors;
}

// Mask sensitive fields for display (NOT for file write)
const SENSITIVE_PATTERNS = [/token/i, /key/i, /password/i, /secret/i, /apikey/i, /accesstoken/i];

function maskForDisplay(obj, depth = 0) {
  if (depth > 5 || !obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(k));
    if (isSensitive && typeof v === 'string' && v.length > 0) {
      out[k] = '***';
    } else if (typeof v === 'object') {
      out[k] = maskForDisplay(v, depth + 1);
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  readConfig,
  writeConfig,
  listProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
  updateLastUsed,
  validateProfile,
  maskForDisplay,
};
