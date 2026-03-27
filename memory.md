# MEMORY MAP — o-cli-manager

> Tài liệu bộ nhớ nhanh cho mọi agent: đọc file này trước để biết cần nhảy vào đâu, tránh scan full codebase.

## 1) Mục tiêu hệ thống

CLI tương tác để chạy task/action cho các service plugin (hiện có Supabase), hỗ trợ:
- Task YAML (sequential + parallel + retry/continue/stop)
- Chạy manual nhiều action
- Quản lý profile config
- Ghi log + session state + changelog/release message

## 2) Entry points quan trọng

- `index.js`
  - Parse flag `--help`, `--export-zip`
  - Khởi động CLI loop/menu
- `README.md`
  - Hướng dẫn vận hành chính thức

## 3) Bản đồ module theo chức năng

### 3.1 CLI/UI layer
- `src/cli/menu.js`
  - Main menu: chạy task file / manual / config / thoát
  - Điều hướng luồng tương tác
- `src/cli/display.js`
  - Render bảng kết quả, mask dữ liệu nhạy cảm, summary output

### 3.2 Core engine layer
- `src/core/engine.js`
  - Discover plugin từ `services/*.js`
  - Gọi action plugin, quản lý context thực thi
- `src/core/task-engine.js`
  - Load + validate task YAML
  - Chạy step sequential/parallel
  - Resolve template `{{ steps.* }}`
  - `on_error`: stop | continue | retry:N
- `src/core/parallel-runner.js`
  - Tiện ích run tác vụ song song + spinner
- `src/core/config-manager.js`
  - Đọc/ghi config YAML theo service
  - CRUD profile + update last_used
- `src/core/session.js`
  - Đọc/ghi `state/session.yaml`
  - Nhớ lựa chọn gần nhất
- `src/core/logger.js`
  - Logger console + file log
  - Mask sensitive fields
- `src/core/changelog-writer.js`
  - Ghi `.opushforce.message`
  - Prepend CHANGE_LOGS(.md/_USER.md)
  - Export source zip

### 3.3 Plugin/service layer
- `services/supabase.js`
  - Plugin Supabase (Management API)
  - Actions: listProjects/createProject/getProjectApiKeys/pauseProject/restoreProject

### 3.4 Data/config/task docs layer
- `configs/supabase.example.yaml`
  - Mẫu config service
- `tasks/supabase-example.yaml`
  - Mẫu task YAML chạy theo engine
- `tasks/TASK_STATUS.yaml`
  - **Source of truth** trạng thái task dự án
- `tasks/sumary.md`
  - Bản human-readable của task board
- `.opushforce.message`
  - Message cho push/release mới nhất
- `CHANGE_LOGS.md`
  - Technical changelog (prepend newest)
- `CHANGE_LOGS_USER.md`
  - User-facing changelog (prepend newest)

## 4) Luồng chạy chuẩn cần nhớ

1. Chọn mode (Task File / Manual / Config)
2. Resolve service + profile
3. Execute actions
4. Collect result + render table
5. Persist session/config last_used
6. Ghi log/changelog/release message nếu cần

## 5) Nên sửa file nào khi gặp từng loại yêu cầu

- **Đổi UX/menu/flow nhập liệu** → `src/cli/menu.js`
- **Đổi cách hiển thị kết quả** → `src/cli/display.js`
- **Lỗi chạy step YAML / retry / context** → `src/core/task-engine.js`
- **Lỗi load plugin/action** → `src/core/engine.js`
- **Lỗi profile/config yaml** → `src/core/config-manager.js`
- **Lỗi session last_used** → `src/core/session.js` (+ có thể `config-manager.js`)
- **Lỗi log/changelog/.opushforce** → `src/core/changelog-writer.js`, `src/core/logger.js`
- **Thêm API service mới hoặc action mới** → `services/<service>.js` + `configs/<service>.example.yaml`
- **Thiếu quy trình/task cho agent** → `task/task.md`, `tasks/TASK_STATUS.yaml`, `tasks/sumary.md`

## 6) Bộ kiểm tra nhanh (không cần quét full)

- `node index.js --help`
- `node -e "const e=require('./src/core/engine'); console.log(e.listServices().map(x=>x.name))"`
- `node -e "const t=require('./src/core/task-engine'); const y=require('js-yaml'); const fs=require('fs'); const obj=y.load(fs.readFileSync('./tasks/supabase-example.yaml','utf8')); console.log(t.validateSchema(obj))"`
- `node -e "const s=require('./services/supabase'); console.log(Object.keys(s.actions))"`

## 7) Quy ước cập nhật tài liệu sau mỗi đợt follow-up

Luôn làm đủ, theo đúng thứ tự ưu tiên:
1. `.opushforce.message` (đồng bộ thông điệp release mới nhất)
2. `CHANGE_LOGS.md` (append entry mới lên đầu)
3. `CHANGE_LOGS_USER.md` (append entry mới lên đầu)
4. `tasks/TASK_STATUS.yaml` + `tasks/sumary.md` (đồng bộ trạng thái)

## 8) Ghi chú cho agent mới vào dự án

- Đọc `memory.md` trước, chỉ mở sâu file liên quan use-case.
- Không đổi format tài liệu trạng thái nếu chưa cần.
- Khi tạo task follow-up: ưu tiên cập nhật trong `task/task.md` + phản ánh vào `tasks/`.
- Nếu có xung đột giữa tài liệu mô tả và code, ưu tiên xác nhận lại bằng lệnh kiểm tra nhanh ở mục 6.
