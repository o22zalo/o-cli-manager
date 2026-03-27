'use strict';

const semver = require('semver');

// Node version check
const nodeVersion = process.version;
if (parseInt(nodeVersion.slice(1)) < 18) {
  console.warn('[WARN] Node.js < 18 detected. Some features may not work correctly.');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  const ts = new Date().toISOString();
  console.log(`\n[INFO] Da thoat luc ${ts}`);
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled Promise Rejection:', reason);
  process.exit(1);
});

const args = process.argv.slice(2);

async function main() {
  // --help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
CLI Service Manager v1.0.0
Quan ly va thuc thi nghiep vu tren nhieu nen tang SaaS/Cloud

Usage:
  node index.js                 Chay CLI tuong tac
  node index.js --export-zip   Xuat toan bo code thanh file ZIP
  node index.js --help         Hien thi huong dan nay

Task Files: ./tasks/*.yaml
Configs:    ./configs/<service>.yaml
Logs:       ./logs/YYYY-MM-DD-<service>.log
State:      ./state/session.yaml
`);
    process.exit(0);
  }

  // --export-zip
  if (args.includes('--export-zip')) {
    try {
      const { exportZip } = require('./src/core/changelog-writer');
      await exportZip();
    } catch (err) {
      console.error('[ERROR] Export ZIP that bai:', err.message);
      process.exit(1);
    }
    return;
  }

  // Main interactive mode
  try {
    const { runMainMenu } = require('./src/cli/menu');
    await runMainMenu();
  } catch (err) {
    console.error('[ERROR] CLI gap loi khong mong doi:', err.message);
    process.exit(1);
  }
}

main();
