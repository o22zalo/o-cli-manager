# CLI Service Manager

CLI Service Manager là công cụ CLI tương tác để quản lý và chạy tác vụ (task/action) trên nhiều dịch vụ SaaS/Cloud theo kiến trúc plugin.

Hiện tại codebase đã có sẵn plugin **Supabase**, hỗ trợ:
- Chạy theo **Task File YAML** (tuần tự + song song + retry/continue/stop).
- Chạy **thủ công nhiều action** trong một lần thao tác.
- Quản lý nhiều **profile cấu hình** cho từng service.
- Ghi log, lưu trạng thái phiên làm việc, cập nhật changelog tự động.

---

## 1) Yêu cầu môi trường

- Node.js **>= 18**
- npm

Kiểm tra nhanh:

```bash
node -v
npm -v
```

---

## 2) Cài đặt

```bash
npm install
```

Chạy CLI:

```bash
npm start
# hoặc
node index.js
```

Xem help:

```bash
node index.js --help
```

Export toàn bộ source thành ZIP (đã loại trừ `node_modules`, `logs`, `state`, `.git` và file config secret):

```bash
npm run export
# hoặc
node index.js --export-zip
```

---

## 3) Cấu trúc thư mục quan trọng

```text
.
├── index.js
├── services/                 # Plugin service (mỗi service 1 file .js)
│   └── supabase.js
├── configs/                  # Cấu hình theo service
│   └── supabase.example.yaml
├── tasks/                    # Task YAML để chạy tự động
│   ├── supabase-example.yaml
│   └── TASK_STATUS.yaml      # file theo dõi tiến độ task nội bộ dự án
├── src/
│   ├── cli/                  # Menu + hiển thị bảng kết quả
│   └── core/                 # Engine, task-engine, logger, session, config manager...
├── logs/                     # Tự tạo khi chạy
├── state/                    # Tự tạo khi chạy
├── CHANGE_LOGS.md            # Tự prepend sau mỗi lần chạy
├── CHANGE_LOGS_USER.md       # Bản tóm tắt thân thiện người dùng
└── .opushforce.message       # Message auto-generate
```

---

## 4) Cấu hình chi tiết để chạy ngay

### Bước 1: Tạo config thật từ file mẫu

```bash
cp configs/supabase.example.yaml configs/supabase.yaml
```

### Bước 2: Điền token Supabase

Mở `configs/supabase.yaml`, điền:

```yaml
profiles:
  - name: default
    credentials:
      accessToken: "YOUR_SUPABASE_PAT"
```

> Lấy PAT tại: `https://supabase.com/dashboard/account/tokens`

### Cấu trúc config chuẩn

```yaml
service: supabase

last_used:
  profile: default
  action: listProjects
  task: supabase-example

profiles:
  - name: default
    description: "Tai khoan chinh"
    credentials:
      accessToken: "YOUR_SUPABASE_PAT"
    meta:
      organization_id: "" # optional
```

Bạn có thể khai báo nhiều profile trong cùng một file `configs/supabase.yaml`.

---

## 5) Cách sử dụng các lệnh CLI

## 5.1 Chạy mode tương tác

```bash
node index.js
```

Menu chính gồm:
1. **Chạy Task File**
2. **Thao tác thủ công**
3. **Quản lý Config**
4. **Thoát**

Sau mỗi lần chạy xong, CLI hỏi bước tiếp theo để bạn tiếp tục ngay.

---

## 5.2 Luồng 1: Chạy Task File (khuyến nghị)

Khi chọn “Chạy Task File”, CLI sẽ:
1. Tự quét `./tasks/*.yaml`.
2. Bạn chọn task.
3. Từ task biết được `service`, sau đó chọn profile.
4. Chạy task theo engine:
   - `type: sequential`: chạy tuần tự.
   - `type: parallel`: các step liền kề kiểu `parallel` sẽ chạy đồng thời.
5. In bảng kết quả từng step (status, duration, output tóm tắt).
6. Tự cập nhật state/changelog/log.

### Ví dụ task có context + parallel

```yaml
name: supabase-inspect-account
service: supabase
steps:
  - id: list_projects
    action: listProjects
    type: sequential
    on_error: stop
    params: {}

  - id: get_keys_first
    action: getProjectApiKeys
    type: sequential
    on_error: continue
    params:
      project_ref: "{{ steps.list_projects.output.data[0].id }}"

  - id: list_projects_again
    action: listProjects
    type: parallel
    on_error: continue
    params: {}

  - id: list_projects_verify
    action: listProjects
    type: parallel
    on_error: continue
    params: {}
```

### Quy tắc `on_error`

- `stop`: dừng task nếu step lỗi.
- `continue`: bỏ qua lỗi và chạy step tiếp theo.
- `retry:N`: thử lại N lần, nếu vẫn lỗi thì xử lý như failed.

---

## 5.3 Luồng 2: Thao tác thủ công (Manual)

Khi chọn “Thao tác thủ công”, CLI sẽ:
1. Chọn service.
2. Chọn profile.
3. Tick nhiều action muốn chạy.
4. Với action có param bắt buộc, CLI hỏi tương tác để nhập.
5. Chạy các action đã chọn theo `Promise.allSettled` (song song).
6. Hiển thị bảng tổng hợp từng action.

### Các action Supabase hiện có

- `listProjects`
- `createProject`
- `getProjectApiKeys`
- `pauseProject`
- `restoreProject`

---

## 5.4 Luồng 3: Quản lý Config trong CLI

Vào menu “Quản lý Config” để:
- Xem danh sách profile.
- Thêm profile mới.
- Sửa profile.
- Xóa profile.

Thông tin nhạy cảm (token/key/password/secret...) được mask khi hiển thị/log (`***`).

---

## 6) Định nghĩa Task File đầy đủ

Schema tối thiểu:

```yaml
name: ten-task
description: "Mo ta"
service: supabase
version: "1.0.0"

steps:
  - id: step_1
    action: listProjects
    type: sequential      # sequential | parallel
    on_error: stop        # stop | continue | retry:N
    params: {}
```

### Tham chiếu context giữa các step

Có thể dùng template `{{ ... }}` để lấy output step trước:

```yaml
project_ref: "{{ steps.list_projects.output.data[0].id }}"
```

Nếu tham chiếu không tồn tại, step sẽ báo lỗi.

---

## 7) Log, state và các file auto-generate

Sau khi chạy task/action, hệ thống tự sinh/cập nhật:

- `logs/YYYY-MM-DD-<service>.log`: log chi tiết theo ngày/service.
- `state/session.yaml`: nhớ lần dùng gần nhất (service/profile/task/action).
- `CHANGE_LOGS.md`: changelog kỹ thuật (prepend bản ghi mới).
- `CHANGE_LOGS_USER.md`: changelog thân thiện người dùng.
- `.opushforce.message`: message tóm tắt lần chạy gần nhất.
- `TASK_STATUS.yaml` (root): cập nhật `last_execution` khi run success.

---

## 8) Lỗi thường gặp & cách xử lý

### 1) `Config chua co...`

Bạn chưa tạo `configs/<service>.yaml` từ file mẫu.

**Cách xử lý:** copy `.example.yaml` sang `.yaml` và điền credentials.

### 2) `Profile '<name>' khong tim thay`

Profile chọn không tồn tại trong file config.

**Cách xử lý:** thêm profile trong YAML hoặc vào menu Quản lý Config để tạo.

### 3) `Task YAML bi loi cu phap`

Task file sai indent hoặc sai format YAML.

**Cách xử lý:** kiểm tra lại spacing/structure trong `tasks/*.yaml`.

### 4) Timeout hoặc lỗi mạng API

Service Supabase dùng timeout 30 giây/request.

**Cách xử lý:** kiểm tra mạng, token, quota hoặc thử lại với `on_error: retry:N`.

---

## 9) Mở rộng thêm service mới

1. Tạo file `services/<service-name>.js` export các trường:
   - `name`, `displayName`, `version`
   - `actions` (mỗi action có `description`, `params`, `execute`)
2. Tạo file `configs/<service-name>.example.yaml`.
3. Service sẽ tự được discover vào menu.

---

## 10) Lệnh nhanh (cheatsheet)

```bash
# cài dependencies
npm install

# chạy CLI tương tác
npm start

# xem hướng dẫn
node index.js --help

# export source zip
npm run export
```

Chỉ cần hoàn thành phần config token là có thể dùng ngay.
