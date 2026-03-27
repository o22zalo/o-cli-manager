'use strict';

const inquirer     = require('inquirer');
const chalk        = require('chalk');

const engine       = require('../core/engine');
const session      = require('../core/session');
const configMgr    = require('../core/config-manager');
const { showActionResultTable } = require('./display');
const { write: writeChangelog, updateTaskStatusExecution } = require('../core/changelog-writer');
const logger                                     = require('../core/logger');

// ── Helpers ────────────────────────────────────────────────────────────────────

function getServiceNames() {
  return engine.listServices().map(s => ({ name: s.displayName + ' (' + s.name + ')', value: s.name }));
}

function getProfileChoices(serviceName) {
  const profiles = configMgr.listProfiles(serviceName);
  if (profiles.length === 0) {
    // Try engine profiles list (from actual yaml)
    const fromEngine = engine.listProfiles(serviceName);
    return fromEngine.length > 0
      ? fromEngine.map(p => ({ name: p, value: p }))
      : [{ name: 'default', value: 'default' }];
  }
  return profiles.map(p => ({ name: p.name + (p.description ? ' — ' + p.description : ''), value: p.name }));
}

function getActionChoices(serviceName) {
  try {
    const svc = engine.getService(serviceName);
    return Object.entries(svc.actions).map(([k, v]) => ({
      name: k + (v.description ? ' — ' + v.description : ''),
      value: k,
    }));
  } catch {
    return [];
  }
}

// ── Config management sub-menu ─────────────────────────────────────────────────

async function runConfigMenu(serviceName) {
  while (true) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: chalk.cyan('Quan ly config: ' + serviceName),
      choices: [
        { name: 'Xem danh sach profile', value: 'list' },
        { name: 'Them profile moi',       value: 'add'  },
        { name: 'Sua profile',            value: 'edit' },
        { name: 'Xoa profile',            value: 'del'  },
        { name: 'Quay lai',               value: 'back' },
      ],
    }]);

    if (action === 'back') break;

    if (action === 'list') {
      const profiles = configMgr.listProfiles(serviceName);
      if (profiles.length === 0) {
        console.log(chalk.yellow('Chua co profile nao.'));
      } else {
        profiles.forEach(p => {
          console.log(chalk.green('  [' + p.name + ']') + ' ' + (p.description || ''));
          const masked = configMgr.maskForDisplay(p.credentials || {});
          console.log('    credentials:', JSON.stringify(masked));
        });
      }
    }

    if (action === 'add' || action === 'edit') {
      let targetName = '';
      if (action === 'edit') {
        const profiles = configMgr.listProfiles(serviceName);
        if (profiles.length === 0) { console.log(chalk.yellow('Chua co profile nao.')); continue; }
        const ans = await inquirer.prompt([{
          type: 'list', name: 'name', message: 'Chon profile can sua:',
          choices: profiles.map(p => ({ name: p.name, value: p.name })),
        }]);
        targetName = ans.name;
      }

      const answers = await inquirer.prompt([
        { type: 'input', name: 'name',        message: 'Ten profile:',       default: targetName || 'default' },
        { type: 'input', name: 'description', message: 'Mo ta (optional):',  default: '' },
        { type: 'password', name: 'accessToken', message: 'Access Token:', mask: '*' },
        { type: 'input', name: 'org_id',      message: 'Organization ID (optional):', default: '' },
        { type: 'password', name: 'defaultDbPass', message: 'Mat khau DB mac dinh (optional):', mask: '*' },
      ]);

      const profile = {
        name: answers.name,
        description: answers.description || undefined,
        credentials: { accessToken: answers.accessToken },
        meta: {
          organization_id: answers.org_id || '',
          default_db_pass: answers.defaultDbPass || '',
        },
      };

      configMgr.saveProfile(serviceName, profile);
      console.log(chalk.green('[OK] Da luu profile "' + answers.name + '"'));
    }

    if (action === 'del') {
      const profiles = configMgr.listProfiles(serviceName);
      if (profiles.length === 0) { console.log(chalk.yellow('Chua co profile nao.')); continue; }
      const ans = await inquirer.prompt([{
        type: 'list', name: 'name', message: 'Chon profile can xoa:',
        choices: profiles.map(p => ({ name: p.name, value: p.name })),
      }]);
      const confirm = await inquirer.prompt([{
        type: 'confirm', name: 'ok', message: 'Xac nhan xoa profile "' + ans.name + '"?', default: false,
      }]);
      if (confirm.ok) {
        configMgr.deleteProfile(serviceName, ans.name);
        console.log(chalk.green('[OK] Da xoa profile "' + ans.name + '"'));
      }
    }
  }
}

// ── Manual action flow ─────────────────────────────────────────────────────────

async function runManualFlow() {
  const services = getServiceNames();
  if (services.length === 0) {
    console.log(chalk.yellow('[WARN] Khong co service nao trong ./services/'));
    return;
  }

  const lastService = session.getLastService() || services[0].value;

  const { serviceName } = await inquirer.prompt([{
    type: 'list', name: 'serviceName', message: 'Chon service:',
    choices: services,
    default: lastService,
  }]);

  const lastProfile    = session.getLastUsed(serviceName, 'last_profile') || 'default';
  const profileChoices = getProfileChoices(serviceName);

  const { profileName } = await inquirer.prompt([{
    type: 'list', name: 'profileName', message: 'Chon profile:',
    choices: profileChoices,
    default: lastProfile,
  }]);

  const { profile } = engine.loadConfig(serviceName, profileName);
  profile._serviceName = serviceName;

  const actionChoices = getActionChoices(serviceName);
  if (actionChoices.length === 0) {
    console.log(chalk.yellow('[WARN] Service nay chua co action nao.'));
    return;
  }

  const { selectedActions } = await inquirer.prompt([{
    type: 'checkbox', name: 'selectedActions', message: 'Chon action(s) muon chay (space de chon):',
    choices: actionChoices,
    validate: (v) => v.length > 0 || 'Chon it nhat 1 action',
  }]);

  // Collect params for each action
  const actionParamsMap = {};
  for (const actionName of selectedActions) {
    const svc    = engine.getService(serviceName);
    const action = svc.actions[actionName];
    const params = (action.params || []).filter(p => p.required);
    if (params.length > 0) {
      console.log(chalk.cyan('\nNhap params cho action: ' + actionName));
      const answers = await inquirer.prompt(
        params.map(p => ({
          type: p.name.toLowerCase().includes('pass') ? 'password' : 'input',
          name: p.name,
          message: p.name + (p.description ? ' (' + p.description + ')' : '') + ':',
          validate: (v) => (v && v.trim()) ? true : p.name + ' la bat buoc',
        }))
      );
      actionParamsMap[actionName] = answers;
    } else {
      actionParamsMap[actionName] = {};
    }
  }

  // Run all selected actions in parallel (Promise.allSettled)
  const startTime = Date.now();
  const spinner   = require('ora')('Dang goi ' + selectedActions.length + ' action(s)...').start();

  const settled = await Promise.allSettled(
    selectedActions.map(async (actionName) => {
      const t0     = Date.now();
      const result = await engine.executeAction(
        serviceName, actionName, actionParamsMap[actionName], profile, logger
      );
      return { action: actionName, ...result, durationMs: Date.now() - t0 };
    })
  );

  const totalMs = Date.now() - startTime;
  const results = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return { action: selectedActions[i], success: false, message: s.reason && s.reason.message, durationMs: 0 };
  });

  spinner.succeed('Hoan thanh ' + results.filter(r => r.success).length + '/' + results.length + ' action(s) trong ' + totalMs + 'ms');

  showActionResultTable(results);

  // Update session
  session.setLastUsed(serviceName, 'last_profile', profileName);
  session.setLastUsed(serviceName, 'last_action', selectedActions[selectedActions.length - 1]);

  // State consistency: update config.last_used only on SUCCESS
  const isManualSuccess = results.every(r => r.success);
  if (isManualSuccess) {
    configMgr.updateLastUsed(serviceName, {
      profile: profileName,
      action: selectedActions[selectedActions.length - 1],
      last_run_at: new Date().toISOString(),
    });
  }

  // Write changelog
  writeChangelog({
    task: 'manual-' + selectedActions.join('-'),
    service: serviceName,
    profile: profileName,
    results: results.map(r => ({ stepId: r.action, id: r.action, status: r.success ? 'SUCCESS' : 'FAILED' })),
    status: isManualSuccess ? 'SUCCESS' : 'PARTIAL',
    totalMs,
  });

  if (isManualSuccess) {
    updateTaskStatusExecution({
      service: serviceName,
      task: 'manual-' + selectedActions.join('-'),
      status: 'SUCCESS',
    });
  }
}

// ── Config management flow ─────────────────────────────────────────────────────

async function runConfigManagementFlow() {
  const services = getServiceNames();
  if (services.length === 0) {
    console.log(chalk.yellow('[WARN] Khong co service nao.'));
    return;
  }

  const { serviceName } = await inquirer.prompt([{
    type: 'list', name: 'serviceName', message: 'Chon service can quan ly config:',
    choices: services,
  }]);

  await runConfigMenu(serviceName);
}

// ── Main menu loop ─────────────────────────────────────────────────────────────

async function runMainMenu() {
  console.log(chalk.bold.cyan('\n=== CLI Service Manager v1.0.0 ===\n'));

  while (true) {
    const { choice } = await inquirer.prompt([{
      type: 'list',
      name: 'choice',
      message: chalk.bold('Menu chinh — chon hanh dong:'),
      choices: [
        { name: '\u2699   Thao tac thu cong  (chon service + action)',        value: 'manual' },
        { name: '\ud83d\udee0  Quan ly Config    (them/sua/xoa profile)',           value: 'config' },
        new inquirer.Separator(),
        { name: '\u23CF  Thoat',                                              value: 'exit'   },
      ],
    }]);

    if (choice === 'exit') {
      console.log(chalk.dim('[INFO] Da thoat luc ' + new Date().toISOString()));
      process.exit(0);
    }

    try {
      if (choice === 'manual') await runManualFlow();
      if (choice === 'config') await runConfigManagementFlow();
    } catch (err) {
      if (err.isTtyError || (err.message && err.message.includes('closed'))) {
        // Inquirer closed (Ctrl+C inside prompt)
        console.log(chalk.dim('\n[INFO] Da thoat luc ' + new Date().toISOString()));
        process.exit(0);
      }
      console.error(chalk.red('[ERROR] ' + err.message));
    }

    // After each action, ask what to do next
    const { next } = await inquirer.prompt([{
      type: 'list',
      name: 'next',
      message: 'Tiep theo?',
      choices: [
        { name: 'Thao tac thu cong',    value: 'manual' },
        { name: 'Doi profile / config', value: 'config' },
        { name: 'Thoat',                value: 'exit'   },
      ],
    }]);

    if (next === 'exit') {
      console.log(chalk.dim('[INFO] Da thoat luc ' + new Date().toISOString()));
      process.exit(0);
    }

    if (next === 'manual') { await runManualFlow();            continue; }
    if (next === 'config') { await runConfigManagementFlow(); continue; }
  }
}

module.exports = { runMainMenu };
