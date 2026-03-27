# TASK BOARD — CLI Service Manager

Last Updated : 2026-03-27 02:25
Updated By : agent

Quick Status: DONE: 8 | IN PROGRESS: 0 | TODO: 3 | BLOCKED: 0

---

## ✅ DONE

### TASK-01 — Khởi tạo project structure

- `index.js` — entry point, xử lý --help, --export-zip, Ctrl+C, unhandledRejection
- `package.json` — đủ dependencies: inquirer@8, chalk@4, winston, axios, js-yaml, ora@5, cli-table3, archiver, chokidar
- `.gitignore` — exclude node*modules/, logs/, state/, configs/*.yaml (giữ \_.example.yaml)
- `README.md` — Install, Config, Usage, Add New Service, Task File Format
- Folder structure: src/core/, src/cli/, services/, tasks/, configs/, state/, logs/

### TASK-02 — Core Logger Module

- `src/core/logger.js`
- Winston logger, log console màu (info=cyan, success=green, error=red, warn=yellow) + file `./logs/YYYY-MM-DD-<service>.log`
- Signature: `logger.info/warn/error/success(service, action, message, meta)`
- Auto-mask sensitive fields: token, key, password, secret, apikey, accesstoken → "\*\*\*"
- Log fields: timestamp | level | service | action | status | duration_ms | detail

### TASK-03 — Core Engine + Plugin Loader

- `src/core/engine.js`
- `listServices()` — auto-discover từ ./services/\*.js
- `loadConfig(serviceName, profileName)` — đọc YAML, trả profile; exit 1 nếu config thiếu
- `executeAction(service, action, params, profile, logger)` — gọi plugin + log + duration
- Thêm file mới vào ./services/ → tự xuất hiện, không cần register

### TASK-04 — Config Manager

- `src/core/config-manager.js`
- `listProfiles / getProfile / saveProfile / deleteProfile / updateLastUsed`
- Validate required fields, in rõ field nào thiếu
- `maskForDisplay()` — mask sensitive khi hiển thị, KHÔNG mask khi ghi file
- Ghi YAML đúng, không mất profile khác khi save

### TASK-05 — Session State Manager

- `src/core/session.js`
- Đọc/ghi `./state/session.yaml`, tự tạo nếu chưa có
- `setLastUsed / getLastUsed / getServiceState / setServiceState / getLastService`
- Xử lý file corrupt: xoá + tạo lại, log warn, KHÔNG crash
- Lưu: last_profile, last_action, last_task, last_run_at per service

### TASK-06 — Task File Engine

- `src/core/task-engine.js`
- `load(taskName)` — đọc + validate schema, in field lỗi cụ thể
- `validateSchema(taskObj)` — kiểm tra required fields task + step
- `run(taskObj, profile, logger)` — thực thi sequential/parallel steps
- Context passing: `{{ steps.X.output.data[0].id }}` syntax
- on_error: stop | continue | retry:N
- Trả về `{ results, totalDuration, success, taskName }`

### TASK-07-partial — Parallel Runner

- `src/core/parallel-runner.js`
- `runParallel(tasks, spinnerText)` — Promise.allSettled + ora spinner
- `withSpinner(text, fn)` — wrap single async op với spinner

### TASK-10-partial — Changelog Writer

- `src/core/changelog-writer.js`
- `write(opts)` — ghi đè `.opushforce.message`, prepend `CHANGE_LOGS.md`, prepend `CHANGE_LOGS_USER.md`
- `exportZip()` — tạo `cli-service-manager-YYYYMMDD.zip`, loại node_modules/logs/state/configs/\*.yaml

---

## 📋 TODO

### TASK-07 — Service — Supabase (mẫu chuẩn)

Status : [ ] TODO
File : `services/supabase.js`
Depends On: TASK-04 ✅
Actions cần implement:

- `listProjects` — GET /v1/projects
- `createProject` — POST /v1/projects
- `getProjectApiKeys` — GET /v1/projects/{ref}/api-keys
- `pauseProject` — POST /v1/projects/{ref}/pause
- `restoreProject` — POST /v1/projects/{ref}/restore
  Interface bắt buộc:

```js
module.exports = {
  name, displayName, version, apiBaseUrl, configSchema,
  actions: {
    actionName: {
      description, params,
      execute: async (config, params, logger) =>
        ({ success, data, message, raw? })
    }
  }
}
```

Dùng Supabase Management API (api.supabase.com), KHÔNG dùng client SDK
Timeout 30s per call, parse lỗi rõ (HTTP status + message)

Quick Verify: `node -e "const s=require('./services/supabase'); console.log(Object.keys(s.actions))"`

---

### TASK-08 — Task File mẫu — Supabase

Status : [ ] TODO
File : `tasks/supabase-example.yaml`
Depends On: TASK-06 ✅, TASK-07
Yêu cầu:

- Ít nhất 4 steps
- 1 parallel group
- Demo context passing: step 2 dùng output từ step 1
- Demo on_error: continue ở step không critical

Quick Verify: `node -e "const t=require('./src/core/task-engine'); t.validateSchema(require('js-yaml').load(require('fs').readFileSync('./tasks/supabase-example.yaml','utf8')))" && echo VALID`

---

### TASK-09 — Interactive CLI + Menu

Status : [ ] TODO
Files : `src/cli/menu.js`, `src/cli/display.js`
Depends On: TASK-05 ✅, TASK-06 ✅, TASK-07, TASK-08
Menu chính (4 lựa chọn):

- [Chạy Task File] → auto-discover ./tasks/\*.yaml → chọn profile → run → result table
- [Thao tác thủ công] → chọn service → profile → multi-select actions → nhập params → run
- [Quản lý Config] → thêm/sửa/xoá profile qua menu
- [Thoát]
  Yêu cầu:
- Default từ session (last service, profile, task)
- Spinner (ora) khi gọi API
- Result table (cli-table3): step | status | duration | output
- Loop sau khi xong: [Chạy tiếp | Thao tác thủ công | Đổi profile | Thoát]
- Multi-select actions → Promise.allSettled song song
- Ctrl+C: log timestamp → exit 0

Quick Verify: `node index.js` → menu xuất hiện, có đủ 4 lựa chọn

---

## 📁 File Map

```
cli-service-manager/
├── index.js                    ✅
├── package.json                ✅
├── README.md                   ✅
├── .gitignore                  ✅
├── TASK.md                     ✅ (file này)
├── .opushforce.message         ✅ (auto-generated)
├── CHANGE_LOGS.md              ✅ (auto-generated)
├── CHANGE_LOGS_USER.md         ✅ (auto-generated)
├── src/
│   ├── core/
│   │   ├── engine.js           ✅
│   │   ├── logger.js           ✅
│   │   ├── config-manager.js   ✅
│   │   ├── session.js          ✅
│   │   ├── task-engine.js      ✅
│   │   ├── parallel-runner.js  ✅
│   │   └── changelog-writer.js ✅
│   └── cli/
│       ├── menu.js             ❌ TODO (TASK-09)
│       └── display.js          ⚠️  skeleton — cần hoàn thiện (TASK-09)
├── services/
│   └── supabase.js             ❌ TODO (TASK-07)
├── tasks/
│   └── supabase-example.yaml   ❌ TODO (TASK-08)
├── configs/
│   └── supabase.example.yaml   ❌ TODO (TASK-11)
├── state/
│   └── .gitkeep               ✅
└── logs/
    └── .gitkeep               ✅
```

---

## Next Actions (thực hiện song song TASK-07 + sau đó TASK-08 → TASK-09)

1. **TASK-07** — `services/supabase.js` (không phụ thuộc gì thêm, làm ngay)
2. **TASK-08** — `tasks/supabase-example.yaml` (sau TASK-07)
3. **TASK-09** — `src/cli/menu.js` + `src/cli/display.js` (sau TASK-07 + TASK-08)
4. **TASK-11** — `configs/supabase.example.yaml` + ZIP export cuối (sau TASK-09)
