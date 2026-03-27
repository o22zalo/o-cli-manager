# CLI Service Manager

CLI tool quan ly va thuc thi nghiep vu tren nhieu nen tang SaaS/Cloud thong qua he thong Task Files va Plugin Services.
Thông tin project:

```
  name: o-cli-manager
  description: CLI tools với kiến trúc plugin-based, task-driven, extensible
```

## Install

```bash
npm install
```

## Config

1. Copy config mau:

```bash
cp configs/supabase.example.yaml configs/supabase.yaml
```

2. Dien credentials vao `configs/supabase.yaml`

## Usage

```bash
# Chay CLI tuong tac
node index.js

# Xuat code ZIP
node index.js --export-zip

# Help
node index.js --help
```

## Add New Service

1. Tao file `services/<ten-service>.js`
2. Export dung interface chuan (xem `services/supabase.js` lam mau)
3. Tao `configs/<ten-service>.example.yaml`
4. Service tu dong xuat hien trong menu

## Task File Format

```yaml
name: ten-task
description: "Mo ta task"
service: supabase
version: "1.0.0"

steps:
  - id: step_1
    action: listProjects
    description: "Mo ta step"
    type: sequential # sequential | parallel
    on_error: stop # stop | continue | retry:3
    params: {}

  - id: step_2
    action: getProjectApiKeys
    params:
      project_ref: "{{ steps.step_1.output.data[0].id }}"
```

## Logs

Log files tu dong tao tai `./logs/YYYY-MM-DD-<service>.log`

## State

Session state luu tai `./state/session.yaml` - tu dong tao, luu last-used choices.
