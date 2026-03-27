'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SERVICES_DIR = path.join(process.cwd(), 'services');
const CONFIGS_DIR  = path.join(process.cwd(), 'configs');

/**
 * List all available services by scanning ./services/*.js
 */
function listServices() {
  if (!fs.existsSync(SERVICES_DIR)) return [];
  return fs.readdirSync(SERVICES_DIR)
    .filter(f => f.endsWith('.js'))
    .map(f => {
      const mod = require(path.join(SERVICES_DIR, f));
      return { name: mod.name, displayName: mod.displayName || mod.name, version: mod.version || '1.0.0' };
    });
}

/**
 * Load a service plugin module
 */
function getService(serviceName) {
  const filePath = path.join(SERVICES_DIR, `${serviceName}.js`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Service '${serviceName}' khong tim thay tai ${filePath}`);
  }
  return require(filePath);
}

/**
 * Load config YAML and return the specified profile
 */
function loadConfig(serviceName, profileName) {
  const configPath = path.join(CONFIGS_DIR, `${serviceName}.yaml`);
  const examplePath = path.join(CONFIGS_DIR, `${serviceName}.example.yaml`);

  if (!fs.existsSync(configPath)) {
    const msg = `Config chua co. Copy ${examplePath} thanh ${configPath} va dien credentials.`;
    console.error(`[ERROR] ${msg}`);
    process.exit(1);
  }

  let config;
  try {
    config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error(`[ERROR] Config YAML bi loi cu phap: ${err.message}`);
    process.exit(1);
  }

  if (!config.profiles || !Array.isArray(config.profiles)) {
    console.error('[ERROR] Config thieu truong "profiles" (array)');
    process.exit(1);
  }

  const targetName = profileName || (config.last_used && config.last_used.profile) || 'default';
  const profile = config.profiles.find(p => p.name === targetName);

  if (!profile) {
    const available = config.profiles.map(p => p.name).join(', ');
    console.error(`[ERROR] Profile '${targetName}' khong tim thay. Co san: ${available}`);
    process.exit(1);
  }

  return { config, profile, configPath };
}

/**
 * List all profiles in a service config
 */
function listProfiles(serviceName) {
  const configPath = path.join(CONFIGS_DIR, `${serviceName}.yaml`);
  if (!fs.existsSync(configPath)) return [];
  try {
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    return (config.profiles || []).map(p => p.name);
  } catch {
    return [];
  }
}

/**
 * Execute a single action on a service
 */
async function executeAction(serviceName, actionName, params, profileConfig, logger) {
  const service = getService(serviceName);

  if (!service.actions || !service.actions[actionName]) {
    throw new Error(`Action '${actionName}' khong tim thay trong service '${serviceName}'`);
  }

  const action = service.actions[actionName];
  const startTime = Date.now();

  logger.info(serviceName, actionName, 'START', { profile: profileConfig.name });

  try {
    const result = await action.execute(profileConfig, params, logger);
    const duration_ms = Date.now() - startTime;

    if (result && result.success) {
      logger.success(serviceName, actionName, result.message || 'DONE', { duration_ms });
    } else {
      logger.error(serviceName, actionName, result ? result.message : 'FAILED', { duration_ms });
    }

    return { ...result, duration_ms };
  } catch (err) {
    const duration_ms = Date.now() - startTime;
    logger.error(serviceName, actionName, err.message, { duration_ms });
    return { success: false, data: null, message: err.message, duration_ms };
  }
}

module.exports = { listServices, getService, loadConfig, listProfiles, executeAction };
