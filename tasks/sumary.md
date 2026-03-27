# TASK BOARD — CLI Service Manager

Last Updated : 2026-03-27 08:05 UTC
Updated By : agent
Status Source of Truth: `TASK_STATUS.yaml`

Quick Status: DONE: 15 | IN PROGRESS: 1 | TODO: 0 | BLOCKED: 0

---

## ✅ DONE

- TASK-01 — Khởi tạo project structure
- TASK-02 — Core Logger Module
- TASK-03 — Core Engine + Plugin Loader
- TASK-04 — Config Manager
- TASK-06 — Task File Engine
- TASK-07 — Service Supabase
- TASK-08 — Task file mẫu Supabase
- TASK-09 — Interactive CLI + Menu
- TASK-10 — Protocol (.opushforce.message + CHANGE_LOGS)
- TASK-11 — ZIP Export + Config Templates + README
- TASK-12 — Governance (Status source + evidence checklist)
- TASK-13 — Task template execute-only cho agent
- TASK-14 — Memory map dự án cho toàn bộ agent
- TASK-15 — Tối ưu luồng Supabase và loại bỏ menu Task File
- TASK-16 — Supabase profile sync + bucket verify workflow

## 🔄 IN PROGRESS

- TASK-05 — Session State Manager (đã có session.yaml; bổ sung đồng bộ `config.last_used` khi run SUCCESS)

---

## Evidence Commands (Regression checklist tối thiểu)

1. `node index.js --help`
2. `node -e "const s=require('./services/supabase'); console.log(Object.keys(s.actions))"`
3. `node -e "const e=require('./src/core/engine'); console.log(e.listServices().map(x=>x.name))"`
4. `node -e "const m=require('./src/cli/menu'); console.log(typeof m.runMainMenu==='function'?'OK':'FAILED')"`

---

## State consistency policy

- Session runtime state: `state/session.yaml`
- Service default state: `configs/<service>.yaml:last_used`
- Khi run SUCCESS: cập nhật cả hai.
- Khi run PARTIAL/FAILED: chỉ cập nhật session, không ghi đè `config.last_used`.
