# TASK TEMPLATE — Execute-Only Workflow (for CLI Service Manager)

> Mục tiêu: Người dùng **chỉ mô tả yêu cầu trong file này**, agent sẽ đọc và thực thi theo full luồng dự án.

## 1) Metadata

- task_id: `TASK-YYYYMMDD-XXX`
- title: `<Tên ngắn gọn của task>`
- owner: `<user/agent>`
- priority: `P0 | P1 | P2`
- status: `TODO | IN_PROGRESS | REVIEW | DONE | BLOCKED`
- created_at_utc: `<YYYY-MM-DD HH:mm:ss>`
- due_at_utc: `<YYYY-MM-DD HH:mm:ss | optional>`

## 2) Mô tả yêu cầu (nguồn sự thật duy nhất)

> Người dùng điền toàn bộ yêu cầu tại đây. Agent không tự suy diễn ngoài phạm vi nếu chưa xác nhận rõ.

- business_goal:
- detailed_requirements:
- constraints:
- non_goals:

## 3) Bối cảnh bắt buộc agent phải đọc trước khi làm

- `README.md` (luồng vận hành + quy ước repo)
- `memory.md` (bản đồ dự án để tránh đọc toàn bộ codebase)
- `tasks/TASK_STATUS.yaml` (nguồn trạng thái chính)
- `tasks/sumary.md` (snapshot trạng thái dễ đọc)

## 4) Đầu vào/đầu ra mong muốn

### Input
- files_to_touch:
- commands_to_run:
- env_notes:

### Output
- deliverables:
  - code_changes
  - docs_updates
  - status_updates
  - verification_report

## 5) Quy trình thực thi chuẩn (agent checklist)

- [ ] A. Đọc instructions + codebase liên quan theo phạm vi nhỏ nhất.
- [ ] B. Lập kế hoạch thay đổi và xác định file cần sửa.
- [ ] C. Thực thi thay đổi.
- [ ] D. Chạy kiểm tra/verify (ít nhất smoke-check phù hợp).
- [ ] E. Tự review (logic, format, backward compatibility, docs).
- [ ] F. Cập nhật các tài liệu bắt buộc sau khi hoàn tất:
  - [ ] Cập nhật `.opushforce.message` theo nội dung PR mới nhất để đồng bộ thông điệp push/release.
  - [ ] Append entry mới **lên đầu** `CHANGE_LOGS.md` để ghi nhận đợt follow-up review.
  - [ ] Append entry mới **lên đầu** `CHANGE_LOGS_USER.md` theo góc nhìn user-facing.
  - [ ] Cập nhật trạng thái task trong thư mục `tasks/`:
    - [ ] `tasks/TASK_STATUS.yaml` (source of truth)
    - [ ] `tasks/sumary.md` (snapshot)
  - [ ] Nếu thiếu task/status liên quan thì bổ sung từ chính nội dung file này.
- [ ] G. Chuẩn bị commit + PR message ngắn gọn, rõ tác động.

## 6) Tiêu chí hoàn thành (Definition of Done)

- [ ] Tất cả yêu cầu trong mục (2) được đáp ứng.
- [ ] Không làm vỡ luồng CLI hiện tại.
- [ ] Có bằng chứng kiểm tra (command + kết quả).
- [ ] Đã cập nhật đầy đủ 3 file release docs: `.opushforce.message`, `CHANGE_LOGS.md`, `CHANGE_LOGS_USER.md`.
- [ ] Trạng thái task đã đồng bộ trong `tasks/`.

## 7) Mẫu báo cáo kết quả (agent điền sau khi chạy)

- execution_summary:
- changed_files:
- verification_commands:
- known_limitations:
- follow_up_recommendations:

## 8) Task status log (append newest on top)

- `[YYYY-MM-DD HH:mm:ss UTC] <STATUS> - <ghi chú ngắn>`
