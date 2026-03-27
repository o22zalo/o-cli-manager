# PROMPT — Node.js CLI Service Manager

# Version: 2.0.0 | Updated: 2025-01-15

---

## [1] ROLE & CONTEXT

Bạn là Senior Node.js Engineer chuyên xây dựng CLI tools với kiến trúc
plugin-based, task-driven, extensible. Bạn đang xây dựng một CLI tool
quản lý và thực thi nghiệp vụ trên nhiều nền tảng SaaS/Cloud thông qua
hệ thống Task Files và Plugin Services.

Mục tiêu: Tạo CLI tool cho phép định nghĩa kịch bản nghiệp vụ trong
task files, chọn service + profile cấu hình, rồi thực thi tự động với
logging đầy đủ — hỗ trợ mở rộng service mới dễ dàng.

---

## [2] TASK DEFINITION

Nhiệm vụ: Xây dựng Node.js CLI tool hoàn chỉnh theo spec dưới đây.

IN SCOPE:

- Task file system: mỗi file = 1 kịch bản nghiệp vụ, agent đọc và tự thực thi
- Plugin architecture: mỗi service = 1 file trong /services/
- Config YAML per service, hỗ trợ nhiều profiles/accounts
- Session state (./state/session.yaml) + auto-update default trong config
- Config manager CLI: cập nhật credentials, thêm/sửa/xoá profile qua menu
- Logging: console màu + file log + result table
- Parallel execution trong task file
- Loop UX: sau khi chạy xong hỏi tiếp
- Protocol ghi file .opushforce.message, CHANGE_LOGS.md, CHANGE_LOGS_USER.md
- Tạo ZIP toàn bộ code khi môi trường web không thể tạo file trực tiếp
- Service ban đầu: Supabase (làm mẫu, các service khác thêm sau)

OUT OF SCOPE:

- GUI/Web interface
- Database lưu history (chỉ dùng log file + session.yaml)
- OAuth flow (chỉ dùng API key/token trong config)
- Real API call trong unit test (dùng mock)
- CLI deploy/CI/CD

---

## [3] INPUT SPECIFICATION

- Config được đọc từ: ./configs/<service-name>.yaml [REQUIRED]
- Task files được đọc từ: ./tasks/<task-name>.yaml [REQUIRED]
- Session state đọc/ghi tại: ./state/session.yaml [AUTO-CREATED]
- User input qua: interactive CLI (inquirer.js)
- Nếu config YAML không tồn tại:
  → In hướng dẫn copy example → exit code 1
- Nếu task file không tồn tại hoặc sai schema:
  → In lỗi cụ thể (field nào sai/thiếu) → exit code 1
- Nếu API call thất bại:
  → Log đầy đủ, KHÔNG crash CLI, tiếp tục vòng lặp

---

## [4] TASK BOARD

⚠️ ĐÂY LÀ NGUỒN SỰ THẬT DUY NHẤT. Đọc phần này TRƯỚC khi làm bất cứ gì.

Quick Status: DONE: 10 | IN PROGRESS: 1 | TODO: 0 | BLOCKED: 0

Next Actions (làm NGAY — song song):

1. TASK-05 — Đồng bộ state session.yaml ↔ configs/<service>.yaml (finalize)
2. TASK-12 — Governance: tự động cập nhật Task Board machine-readable + regression evidence

——— TASK LIST ———

TASK-01: Khởi tạo project structure
Status : [x] DONE
Type : [PARALLEL]
Priority : HIGH
Mô tả : Tạo toàn bộ folder structure, package.json với dependencies,
.gitignore, README skeleton. Tạo sẵn thư mục logs/, state/,
configs/, tasks/, services/.
Completion Conditions:
✅ package.json có đủ: inquirer@8, chalk@4, winston, axios, js-yaml,
ora@5, cli-table3, archiver (cho ZIP), chokidar [OPTIONAL]
✅ Folder structure khớp với spec OUTPUT FORMAT
✅ node index.js --help chạy không lỗi
✅ .gitignore bao gồm: logs/, state/, configs/_.yaml (không ignore _.example.yaml)
Quick Verify : → node -e "require('./src/core/engine')" && echo OK
Depends On : NONE
Blocks : TASK-03, TASK-04, TASK-05, TASK-06

TASK-02: Core Logger Module
Status : [x] DONE
Type : [PARALLEL]
Priority : HIGH
Mô tả : Winston logger, log ra console (màu theo level) và file
./logs/YYYY-MM-DD-<service>.log. Format chuẩn bắt buộc.
Completion Conditions:
✅ logger.info/warn/error/success(service, action, message, meta) hoạt động
✅ File log tự tạo tại ./logs/ với tên YYYY-MM-DD-<service>.log
✅ Log fields đủ: timestamp | level | service | action | status | duration_ms | detail
✅ Sensitive fields (token, key, password, secret, apikey) bị mask = "\*\*\*"
✅ Console: info=cyan, success=green, error=red, warn=yellow (chalk)
Quick Verify : → node -e "const l=require('./src/core/logger'); l.info('test','ping','OK',{})" && ls logs/
Depends On : NONE
Blocks : TASK-03

TASK-03: Core Engine + Plugin Loader
Status : [x] DONE
Type : [SEQUENTIAL → TASK-01, TASK-02]
Priority : HIGH
Mô tả : Auto-discover services từ ./services/_.js, load config YAML,
expose interface chuẩn. Thêm service mới = thêm file JS là xong.
Completion Conditions:
✅ engine.listServices() trả về array từ ./services/_.js
✅ engine.loadConfig(serviceName, profileName) đọc đúng YAML + trả profile
✅ engine.executeAction(service, action, params, logger) gọi method + log
✅ Thêm file mới vào ./services/ → tự xuất hiện trong menu (không cần register)
Quick Verify : → node -e "const e=require('./src/core/engine'); console.log(e.listServices())"
Depends On : TASK-01, TASK-02
Blocks : TASK-04, TASK-05, TASK-07, TASK-09, TASK-10

TASK-04: Config Manager (YAML + CLI update)
Status : [x] DONE
Type : [SEQUENTIAL → TASK-03]
Priority : HIGH
Mô tả : Đọc/ghi config YAML per service. Hỗ trợ thêm/sửa/xoá profile
qua menu CLI. Validate schema trước khi lưu.
Completion Conditions:
✅ Đọc ./configs/<service>.yaml, parse mảng profiles
✅ configManager.getProfile(service, name) hoạt động
✅ configManager.saveProfile(service, profile) ghi đúng YAML, không mất profile khác
✅ configManager.deleteProfile(service, name) xoá được profile
✅ Validate required fields — in lỗi rõ (field nào thiếu) nếu sai
✅ Sensitive fields bị mask khi hiển thị ra console, KHÔNG mask khi ghi file
✅ Menu CLI: Thêm profile / Sửa profile / Xoá profile / Xem danh sách
Quick Verify : → node -e "const c=require('./src/core/config-manager'); console.log(c.listProfiles('supabase'))"
Depends On : TASK-03
Blocks : TASK-05, TASK-06, TASK-07

TASK-05: Session State Manager
Status : [~] PARTIAL
Type : [SEQUENTIAL → TASK-04]
Priority : HIGH
Mô tả : Đọc/ghi ./state/session.yaml. Lưu last-used service, profile,
task, action per service. Khi menu hiện ra, tự điền sẵn lựa
chọn cuối cùng làm default.
Completion Conditions:
✅ state/session.yaml tự tạo nếu chưa có (không crash)
✅ session.setLastUsed(service, key, value) và session.getLastUsed(service, key) hoạt động
✅ Inquirer menu dùng default từ session (service, profile, task, action)
✅ Sau mỗi lần chạy thành công → cập nhật last_used trong config YAML của service đó
✅ Session lưu: last_service, last_profile, last_task, last_action, last_run_at
Quick Verify : → node -e "const s=require('./src/core/session'); s.setLastUsed('supabase','profile','default'); console.log(s.getLastUsed('supabase','profile'))"
Depends On : TASK-04
Blocks : TASK-09, TASK-10

TASK-06: Task File Engine
Status : [x] DONE
Type : [SEQUENTIAL → TASK-04]
Priority : HIGH
Mô tả : Engine đọc ./tasks/<name>.yaml, validate schema, thực thi
từng step tuần tự hoặc song song theo cấu hình trong file.
Mỗi step = 1 action của 1 service với params định sẵn.
Completion Conditions:
✅ taskEngine.load(taskFile) đọc và validate YAML schema
✅ taskEngine.run(taskFile, profile, logger) thực thi đúng thứ tự steps
✅ Step có type: sequential (mặc định) hoặc parallel
✅ Step thất bại: log lỗi, tuỳ thuộc on_error (stop | continue | retry:N)
✅ Context passing: output của step N có thể làm input của step N+1
qua cú pháp "{{ steps.step_id.output.field }}"
✅ Sau khi chạy xong: in summary table (step | status | duration | output tóm tắt)
Quick Verify : → node -e "const t=require('./src/core/task-engine'); console.log(t.validateSchema(require('./tasks/supabase-example.yaml')))"
Depends On : TASK-04
Blocks : TASK-08, TASK-09

TASK-07: Service — Supabase (mẫu chuẩn)
Status : [x] DONE
Type : [SEQUENTIAL → TASK-04]
Priority : HIGH
Mô tả : Plugin Supabase Management API làm mẫu chuẩn cho tất cả
service sau này. 5 actions: listProjects, createProject,
getProjectApiKeys, pauseProject, restoreProject.
Completion Conditions:
✅ ./services/supabase.js export đúng interface chuẩn (xem OUTPUT FORMAT)
✅ Mỗi action có: description, params schema, execute(config, params, logger)
✅ execute() trả về { success: boolean, data: any, message: string, raw?: any }
✅ Lỗi từ Supabase API được parse rõ (status code + error message)
✅ Dùng Supabase Management API (api.supabase.com), không phải client SDK
✅ projectRef có thể lấy từ params hoặc context ({{ steps.xxx.output.id }})
Quick Verify : → node -e "const s=require('./services/supabase'); console.log(Object.keys(s.actions))"
Depends On : TASK-04
Blocks : TASK-08

TASK-08: Task File mẫu — Supabase
Status : [x] DONE
Type : [SEQUENTIAL → TASK-06, TASK-07]
Priority : HIGH
Mô tả : Tạo ./tasks/supabase-example.yaml minh hoạ đầy đủ tính năng:
sequential step, parallel step, context passing, on_error.
Completion Conditions:
✅ tasks/supabase-example.yaml có ít nhất 4 steps (1 parallel group)
✅ Demo context passing: step 2 dùng output từ step 1
✅ Demo on_error: continue ở step không critical
✅ taskEngine.run() chạy file này không lỗi schema
Quick Verify : → node -e "const t=require('./src/core/task-engine'); t.validateSchema(require('js-yaml').load(require('fs').readFileSync('./tasks/supabase-example.yaml','utf8')))" && echo VALID
Depends On : TASK-06, TASK-07
Blocks : TASK-09

TASK-09: Interactive CLI + Parallel Runner
Status : [x] DONE
Type : [SEQUENTIAL → TASK-05, TASK-06, TASK-08]
Priority : HIGH
Mô tả : Main CLI flow dùng inquirer. Hai luồng: (A) chọn task file
để chạy tự động, (B) chọn service + action thủ công.
Sau khi chạy: hiển thị result table → hỏi tiếp.
Completion Conditions:
✅ Menu chính: [Chạy Task File] | [Thao tác thủ công] | [Quản lý Config] | [Thoát]
✅ Luồng A: chọn task file (auto-discover ./tasks/\*.yaml) → chọn profile → run
✅ Luồng B: chọn service → chọn profile → multi-select actions → nhập params → run
✅ Multi-select actions → Promise.allSettled() song song
✅ Result table: action | status | duration | detail (cli-table3)
✅ Spinner (ora) khi đang gọi API
✅ Default từ session (last-used service, profile, task)
✅ Loop: sau khi xong hỏi [Chạy tiếp task khác | Thao tác thủ công | Đổi profile | Thoát]
✅ Ctrl+C: log "Đã thoát lúc <timestamp>" → exit 0
Quick Verify : → node index.js -- menu xuất hiện, có đủ 4 lựa chọn chính
Depends On : TASK-05, TASK-06, TASK-08
Blocks : TASK-10

TASK-10: Protocol — .opushforce.message + CHANGE_LOGS
Status : [x] DONE
Type : [SEQUENTIAL → TASK-09]
Priority : HIGH
Mô tả : Sau mỗi lần thực thi task thành công, tự động cập nhật 3 file
tại root CLI tool. Tạo file nếu chưa tồn tại.
Completion Conditions:
✅ .opushforce.message được ghi đè nội dung PR message theo task vừa chạy
✅ CHANGE_LOGS.md: append entry mới lên ĐẦU FILE (prepend, không append cuối)
✅ CHANGE_LOGS_USER.md: append entry mới lên ĐẦU FILE, dưới góc nhìn user-facing
✅ Cả 3 file được tạo tự động nếu chưa tồn tại (không crash)
✅ Format entry CHANGE_LOGS xem OUTPUT FORMAT bên dưới
Quick Verify : → node -e "require('./src/core/changelog-writer').write({task:'test',service:'supabase',actions:['listProjects'],status:'SUCCESS'})" && head -5 CHANGE_LOGS.md
Depends On : TASK-09
Blocks : TASK-11

TASK-11: ZIP Export + Config Templates + README
Status : [x] DONE
Type : [SEQUENTIAL → TASK-10]
Priority : MEDIUM
Mô tả : Tạo ZIP toàn bộ code khi chạy trên môi trường web. Tạo
config example YAML. Viết README đầy đủ.
Completion Conditions:
✅ node index.js --export-zip tạo file cli-service-manager-<date>.zip
✅ ZIP chứa đúng cấu trúc, giải nén ra là dùng được ngay (npm install → node index.js)
✅ ZIP KHÔNG chứa: node*modules/, logs/, state/, configs/*.yaml (chỉ \_.example.yaml)
✅ Tên file và path trong ZIP: KHÔNG dùng ký tự {}, $, backtick trong tên
✅ Code trong ZIP: kiểm tra kỹ template literals và string có nháy đơn/kép lồng nhau
✅ configs/supabase.example.yaml có đầy đủ mọi field, comment giải thích
✅ README có: Install, Config, Usage, Add New Service, Task File Format
Quick Verify : → node index.js --export-zip && unzip -t cli-service-manager-\*.zip && echo ZIP_OK
Depends On : TASK-10
Blocks : NONE



### TASK-12: Governance — Status source of truth + evidence checklist
Status : [x] DONE
Type : [PARALLEL]
Priority : HIGH
Mô tả : Chuẩn hoá quản trị tiến độ để Task Board không lệch codebase.
Completion Conditions:
✅ Có file machine-readable `TASK_STATUS.yaml` làm nguồn sự thật trạng thái task
✅ Sau mỗi lần chạy task/manual thành công, tự động cập nhật metadata `last_execution` trong TASK_STATUS.yaml
✅ Definition of Done yêu cầu evidence commands + expected output (pass/fail)
✅ Có tiêu chí state consistency: session.yaml vs configs/<service>.yaml
✅ Có regression checklist tối thiểu: --help, task schema validate, service actions introspection, menu smoke test
Quick Verify : → node -e "const fs=require('fs'); console.log(fs.existsSync('./TASK_STATUS.yaml')?'OK':'MISSING')"
Depends On : NONE
Blocks : NONE

——— RULES ĐỌC TASK BOARD ———

1. Tìm tất cả [PARALLEL] có Status TODO → thực hiện ngay, không cần chờ
2. [SEQUENTIAL] → kiểm tra TẤT CẢ Depends On đã [x] DONE chưa
3. Chạy Quick Verify trước khi đánh dấu [x] DONE
4. Cập nhật Status + AGENT_MEMORY.md ngay sau mỗi task
5. Thứ tự ưu tiên: BLOCKER → HIGH PARALLEL → HIGH SEQUENTIAL → MEDIUM

---



## [4.1] TASK GOVERNANCE (MỚI)

### Status source of truth
- File chuẩn duy nhất: `./TASK_STATUS.yaml`
- Task Board markdown chỉ là view để đọc nhanh; khi conflict, ưu tiên `TASK_STATUS.yaml`.
- Sau mỗi lần run thành công (task/manual), phải cập nhật:
  - `last_execution.at` (ISO timestamp)
  - `last_execution.service`
  - `last_execution.task`

### Definition of Done (bắt buộc)
Mỗi task chỉ được đánh DONE khi có đủ:
1. Code/artefact đã có trong repo
2. Evidence commands đã chạy
3. Expected output đạt PASS
4. Cập nhật `TASK_STATUS.yaml` + Task Board

### State consistency rule
- Nguồn state runtime: `state/session.yaml`
- Nguồn default config theo service: `configs/<service>.yaml:last_used`
- Sau run **SUCCESS**:
  - cập nhật session: `last_profile`, `last_task`/`last_action`, `last_run_at`
  - cập nhật config.last_used tương ứng
- Nếu run PARTIAL/FAILED: chỉ cập nhật session, không ghi đè `config.last_used`

### Regression checklist tối thiểu (bắt buộc sau mỗi task lớn)
- `node index.js --help`
- `node -e "const t=require('./src/core/task-engine'); const y=require('js-yaml'); const fs=require('fs'); const obj=y.load(fs.readFileSync('./tasks/supabase-example.yaml','utf8')); const errs=t.validateSchema(obj); console.log(errs.length?errs:'VALID')"`
- `node -e "const s=require('./services/supabase'); console.log(Object.keys(s.actions))"`
- Menu smoke test: mở `node index.js` và xác nhận 4 lựa chọn chính xuất hiện

## [5] OUTPUT FORMAT

### Folder structure bắt buộc:

```
cli-service-manager/
├── index.js                         ← entry point
├── package.json
├── README.md
├── .gitignore
├── .opushforce.message              ← auto-generated, ghi đè mỗi lần run
├── CHANGE_LOGS.md                   ← auto-generated, prepend
├── CHANGE_LOGS_USER.md              ← auto-generated, prepend
├── src/
│   ├── core/
│   │   ├── engine.js                ← plugin loader, action executor
│   │   ├── logger.js                ← winston wrapper
│   │   ├── config-manager.js        ← đọc/ghi/validate YAML config
│   │   ├── session.js               ← đọc/ghi state/session.yaml
│   │   ├── task-engine.js           ← đọc task YAML, thực thi steps
│   │   ├── parallel-runner.js       ← Promise.allSettled wrapper + progress
│   │   └── changelog-writer.js      ← ghi .opushforce.message + CHANGE_LOGS
│   └── cli/
│       ├── menu.js                  ← inquirer menus (main, config, task)
│       └── display.js               ← result table, spinner, summary
├── services/
│   └── supabase.js                  ← Supabase plugin (mẫu chuẩn)
├── tasks/
│   └── supabase-example.yaml        ← Task file mẫu
├── configs/
│   └── supabase.example.yaml        ← Config template (KHÔNG gitignore file này)
├── state/
│   └── .gitkeep                     ← session.yaml tự tạo ở đây khi chạy
└── logs/
    └── .gitkeep                     ← log files tự tạo ở đây
```

### Config YAML format (./configs/supabase.yaml):

```yaml
service: supabase
last_used:
  profile: default
  action: listProjects
  task: supabase-example

profiles:
  - name: default
    description: "Tài khoản Supabase chính"
    credentials:
      accessToken: "YOUR_SUPABASE_PAT" # Personal Access Token
    meta:
      organization_id: "" # [OPTIONAL]

  - name: client-abc
    description: "Tài khoản client ABC"
    credentials:
      accessToken: "ANOTHER_TOKEN"
    meta:
      organization_id: "org-xyz"
```

### Task File YAML format (./tasks/<name>.yaml):

```yaml
name: supabase-setup-new-project
description: "Tạo project Supabase mới và lấy API keys"
service: supabase
version: "1.0.0"

steps:
  - id: list_orgs
    action: listOrganizations
    description: "Lấy danh sách organizations"
    type: sequential # sequential (default) | parallel
    on_error: stop # stop (default) | continue | retry:3
    params: {}

  - id: create_proj
    action: createProject
    description: "Tạo project mới"
    type: sequential
    on_error: stop
    params:
      name: "my-new-project"
      organization_id: "{{ steps.list_orgs.output.data[0].id }}"
      region: "ap-southeast-1"
      plan: "free"

  - id: get_keys
    action: getProjectApiKeys
    description: "Lấy API keys"
    type: sequential
    on_error: continue
    params:
      project_ref: "{{ steps.create_proj.output.data.id }}"
```

### Service plugin interface chuẩn (bắt buộc):

```javascript
// services/<name>.js
module.exports = {
  name: "supabase",
  displayName: "Supabase",
  version: "1.0.0",
  apiBaseUrl: "https://api.supabase.com/v1",
  configSchema: {
    required: ["accessToken"],
    optional: ["organization_id"],
  },
  actions: {
    listProjects: {
      description: "Liệt kê tất cả projects trong tài khoản",
      params: [],
      execute: async (config, params, logger) => {
        // Trả về bắt buộc:
        // { success: boolean, data: any, message: string, raw?: any }
      },
    },
  },
};
```

### Session state (./state/session.yaml):

```yaml
last_updated: "2025-01-15T14:23:01.000Z"
services:
  supabase:
    last_profile: default
    last_action: listProjects
    last_task: supabase-example
    last_run_at: "2025-01-15T14:23:01.000Z"
```

### Log format (./logs/YYYY-MM-DD-<service>.log):

```
2025-01-15 14:23:01 | INFO    | supabase | listProjects  | START   | profile=default
2025-01-15 14:23:02 | SUCCESS | supabase | listProjects  | DONE    | duration=1243ms | projects=5
2025-01-15 14:23:02 | ERROR   | supabase | createProject | FAILED  | duration=234ms  | 422: Project name already taken
```

### Result table (hiển thị sau khi chạy):

```
Task: supabase-setup-new-project | Profile: default | 2025-01-15 14:23:05
┌──────────────┬─────────────┬──────────┬─────────────────────────────┐
│ Step         │ Status      │ Duration │ Output                      │
├──────────────┼─────────────┼──────────┼─────────────────────────────┤
│ list_orgs    │ ✅ SUCCESS  │ 891ms    │ 2 organizations found       │
│ create_proj  │ ✅ SUCCESS  │ 2,341ms  │ id=abc123, region=ap-se-1   │
│ get_keys     │ ✅ SUCCESS  │ 543ms    │ anon_key=***, service_key=***│
└──────────────┴─────────────┴──────────┴─────────────────────────────┘
```

### .opushforce.message format (ghi đè toàn bộ):

```
[CLI Run] supabase / supabase-setup-new-project @ 2025-01-15 14:23:05

Steps executed: list_orgs ✅ | create_proj ✅ | get_keys ✅
Profile: default | Duration: 3,775ms | Status: SUCCESS
```

### CHANGE_LOGS.md format (prepend — thêm lên ĐẦU FILE):

```markdown
## [2025-01-15 14:23:05] supabase — supabase-setup-new-project

- **Service**: Supabase Management API
- **Task**: supabase-setup-new-project
- **Profile**: default
- **Steps**: list_orgs ✅ | create_proj ✅ | get_keys ✅
- **Duration**: 3,775ms
- **Status**: SUCCESS

---
```

### CHANGE_LOGS_USER.md format (prepend — thêm lên ĐẦU FILE):

```markdown
## [2025-01-15 14:23:05] Khởi tạo project Supabase mới

Đã thực hiện thành công việc tạo project Supabase mới "my-new-project"
tại region ap-southeast-1. API keys đã được lấy về.

---
```

---

## [6] CONSTRAINTS & RULES

LUÔN:

- Validate config YAML trước khi gọi API, fail fast với message rõ
- Mask sensitive fields (token, key, password, secret, apikey, accesstoken)
  bằng "\*\*\*" khi log ra console/file — KHÔNG mask khi ghi vào config file
- Handle try/catch ở mọi async function
- Dùng async/await, không dùng .then().catch() chains
- Timeout 30 giây mỗi API call (configurable trong config YAML)
- Prepend (thêm đầu file) khi ghi CHANGE_LOGS.md và CHANGE_LOGS_USER.md
- Tạo file nếu chưa tồn tại (.opushforce.message, CHANGE_LOGS.md, CHANGE_LOGS_USER.md)
- Cập nhật session.yaml sau mỗi lần chạy thành công
- Cập nhật last_used trong config YAML của service sau mỗi lần chạy

KHÔNG BAO GIỜ:

- Hardcode credentials, token, API key trong source code
- Dùng process.exit() đột ngột — luôn log lý do trước
- Để unhandled promise rejection
- Gọi real API trong unit test — dùng mock
- Dùng ký tự {}, $, backtick trong tên file hoặc đường dẫn khi tạo ZIP
- Tạo ZIP thiếu file (phải có toàn bộ src/, services/, tasks/, configs/\*.example.yaml)

NẾU config YAML không tồn tại:
→ In: "Config chưa có. Copy configs/<service>.example.yaml thành
configs/<service>.yaml và điền credentials." → exit 1

NẾU task file có lỗi schema:
→ In đúng field bị lỗi/thiếu → exit 1

NẾU API call thất bại:
→ Log error đầy đủ (HTTP status + message từ API response)
→ Tuân theo on_error của step (stop/continue/retry:N)
→ KHÔNG crash CLI

NẾU step dùng context "{{ steps.X.output.Y }}" mà X chưa có output:
→ Log lỗi rõ: "Context reference 'steps.X.output.Y' không có giá trị" → stop task

NẾU môi trường web không tạo được file trực tiếp (kiểm tra bằng cách
thử ghi file test và bắt lỗi EROFS / EACCES / read-only filesystem):
→ Tự động chạy chế độ ZIP export
→ Tạo file cli-service-manager-<YYYYMMDD>.zip chứa TOÀN BỘ code
→ ZIP phải đúng cấu trúc, giải nén → chép vào source hiện hành là dùng được
→ Kiểm tra kỹ: template literals (`...`), string có nháy đơn/kép lồng nhau
trong code trước khi đưa vào ZIP — đây là nguồn lỗi phổ biến nhất

NẾU user nhấn Ctrl+C:
→ Log "Đã thoát lúc <ISO timestamp>" → exit 0

---

## [7] FALLBACK LOGIC

- Thiếu config YAML: hướng dẫn copy example → exit 1
- Config sai schema: liệt kê fields thiếu/sai → exit 1
- Task file không tồn tại: liệt kê task files có sẵn → exit 1
- Task file sai schema: in đúng field lỗi → exit 1
- API timeout (>30s): log TIMEOUT, đánh dấu step FAILED, tuân theo on_error
- Context reference fail: log rõ tên field thiếu → stop task
- Parallel step có 1 fail: log riêng từng step, không ảnh hưởng step song song khác
- session.yaml bị corrupt: xoá và tạo lại (log warn, KHÔNG crash)
- Không có internet: bắt ECONNREFUSED/ETIMEDOUT và log message thân thiện
- Node.js < 18: warn nhưng vẫn chạy
- Môi trường web (không ghi được file): tự động export ZIP (xem CONSTRAINTS)

---

## [8] MEMORY PROTOCOL

⚠️ BẮT BUỘC THỰC HIỆN Ở ĐẦU VÀ CUỐI MỖI SESSION.

### KHỞI ĐỘNG SESSION (< 2 phút)

Bước 1 — Đọc AGENT_MEMORY.md tại root project.
Nếu chưa tồn tại → tạo mới theo template bên dưới.
Bước 2 — Đọc Quick Status + Next Actions → biết ngay việc cần làm.
Bước 3 — Đọc Session Log gần nhất → hiểu context từ session trước.
Bước 4 — Verify task [x] DONE bằng Quick Verify tương ứng.
Nếu fail → chuyển về [~] IN PROGRESS, ghi vào Known Issues.
Bước 5 — Bắt đầu: HIGH PARALLEL → HIGH SEQUENTIAL → MEDIUM.

### KẾT THÚC SESSION (bắt buộc trước khi dừng)

Cập nhật AGENT_MEMORY.md với:

- Status mới của các task đã xử lý
- Session Log mới (xem template)
- Next Actions cập nhật
- Quick Status counter cập nhật
- Timestamp Last Updated

### RULES CỨNG

- [x] DONE chỉ được gán khi ALL Completion Conditions pass + Quick Verify OK
- Session Log PHẢI ghi trước khi dừng — không ghi = session không hợp lệ
- Không xoá Decisions Log / Known Issues cũ — chỉ thêm mới
- Nếu dependency thay đổi → cập nhật Depends On của task liên quan ngay

---

## AGENT_MEMORY.md TEMPLATE

Tạo file này tại root project khi bắt đầu session đầu tiên:

```markdown
# AGENT MEMORY — CLI Service Manager

Last Updated : YYYY-MM-DD HH:MM
Updated By : agent

---

## PROJECT SNAPSHOT

Goal : Node.js CLI task-driven, quản lý API multi-service (Supabase, mở rộng sau)
Phase : BUILDING
Stack : Node.js 18+, inquirer@8, chalk@4, winston, axios, js-yaml, ora@5, cli-table3, archiver
Entry Points:

- Run : node index.js
- Export : node index.js --export-zip
- Test : npm test

---

## TASK BOARD

[Copy toàn bộ Task Board từ [4] vào đây — cập nhật liên tục]

Quick Status: DONE: 10 | IN PROGRESS: 1 | TODO: 0 | BLOCKED: 0

Next Actions:

1. TASK-01 — Khởi tạo project structure
2. TASK-02 — Core Logger Module

---

## DECISIONS LOG

| ID   | Quyết định                           | Lý do                                 | Ngày | Ảnh hưởng |
| ---- | ------------------------------------ | ------------------------------------- | ---- | --------- |
| D-01 | Config dùng YAML thay JSON           | Dễ đọc, hỗ trợ comment                | -    | TASK-04   |
| D-02 | inquirer v8 (CommonJS)               | Tránh ESM issues với require()        | -    | TASK-09   |
| D-03 | Promise.allSettled cho parallel      | 1 fail không crash batch              | -    | TASK-09   |
| D-04 | Prepend CHANGE_LOGS (thêm đầu file)  | Entry mới nhất luôn ở trên            | -    | TASK-10   |
| D-05 | archiver cho ZIP                     | Stable, hỗ trợ stream, không lỗi path | -    | TASK-11   |
| D-06 | Session state tách riêng khỏi config | Config = credentials, state = UX      | -    | TASK-05   |

---

## KNOWN ISSUES

| ID   | Mô tả                                            | Severity | Task    | Workaround                           |
| ---- | ------------------------------------------------ | -------- | ------- | ------------------------------------ |
| I-01 | Template literals trong ZIP có thể bị escape sai | HIGH     | TASK-11 | Dùng String.raw hoặc escape thủ công |

---

## KEY FILES MAP

index.js ← Entry point + --export-zip flag
src/core/engine.js ← Plugin loader + action executor
src/core/logger.js ← Winston wrapper (mask sensitive)
src/core/config-manager.js ← Đọc/ghi/validate YAML config
src/core/session.js ← state/session.yaml manager
src/core/task-engine.js ← Task YAML loader + step executor
src/core/parallel-runner.js ← Promise.allSettled + spinner
src/core/changelog-writer.js ← Ghi .opushforce.message + CHANGE_LOGS
src/cli/menu.js ← Inquirer menus
src/cli/display.js ← Table, spinner, summary
services/supabase.js ← Supabase plugin (mẫu cho service khác)
tasks/supabase-example.yaml ← Task file mẫu

---

## SESSION LOG

### Session 001 — YYYY-MM-DD HH:MM

Đã làm : [...]
Kết quả task : [...]
Vấn đề gặp phải : [...]
Context cho session sau: [...]
Dừng vì : [hết token / hoàn thành / bị block bởi TASK-XX]
```

---

## STRESS TEST RESULTS

```
✅ Input trống           → Config manager bắt lỗi, hướng dẫn tạo config
✅ Config YAML sai       → Validate schema, in field thiếu/sai, exit 1
✅ Task file sai schema  → Print đúng field lỗi, exit 1
✅ Context ref fail      → Log "steps.X.output.Y không có giá trị" → stop
✅ API timeout           → Bắt timeout 30s, log TIMEOUT, theo on_error
✅ Parallel 1 step fail  → allSettled, step khác không bị ảnh hưởng
✅ Session corrupt       → Xoá + tạo lại, log warn
✅ Môi trường web        → Auto detect, export ZIP đúng cấu trúc
✅ ZIP path có ký tự lạ  → Rule cứng: không dùng {}, $, backtick trong path
✅ Template literal ZIP  → Kiểm tra kỹ escape trước khi đóng gói
✅ Scope creep           → OUT OF SCOPE liệt kê rõ (no GUI, no DB, no OAuth)
✅ Idempotency           → Cùng task + input = cùng kết quả, 100 lần chạy OK
```

[CONFIDENCE: HIGH] — Spec đầy đủ 11 tasks, edge cases đã xử lý, ZIP protocol cứng hoá.

```

---

## CHECKLIST LEVEL 1 — XÁC NHẬN TRƯỚC KHI GIAO

```

✅ [1] ROLE & CONTEXT — Vai trò rõ, bối cảnh rõ
✅ [2] TASK DEFINITION — IN/OUT SCOPE đầy đủ
✅ [3] INPUT SPECIFICATION — YAML format, task file, fallback nếu thiếu
✅ [4] TASK BOARD — 11 tasks, Status/Type/CC/QuickVerify/Depends/Blocks
✅ [4] TASK BOARD — Next Actions + Quick Status counter
✅ [4] TASK BOARD — PARALLEL và SEQUENTIAL gán đúng nhãn
✅ [5] OUTPUT FORMAT — Ví dụ cụ thể: folder, YAML, log, table, ZIP, CHANGE_LOGS
✅ [6] CONSTRAINTS — LUÔN + KHÔNG BAO GIỜ + NẾU ... THÌ ... rõ ràng
✅ [7] FALLBACK — 10 tình huống edge case đã xử lý
✅ [8] MEMORY PROTOCOL — Khởi động + kết thúc session + template đầy đủ
✅ Stress test 12 câu đã chạy, rủi ro đã xử lý
✅ Anchor Output áp dụng (YAML schema, interface, log format cụ thể)
✅ Scope Guard áp dụng (OUT OF SCOPE rõ ràng)
✅ ZIP protocol cứng hoá (no {}, kiểm tra quote, toàn bộ code)
✅ Prompt chạy được NGAY, không cần chỉnh thêm

```

```
