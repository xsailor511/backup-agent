<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BackupAgent 项目说明

## 项目概述

基于 Tauri v2 + Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui 的桌面备份工具。

## 项目结构

```
backup-agent/
├── src/                          # Next.js 前端
│   ├── app/                      # App Router 页面
│   │   ├── backup/page.tsx       # 备份页面
│   │   ├── restore/page.tsx      # 恢复页面
│   │   └── config/page.tsx       # 配置页面
│   ├── components/              # React 组件
│   │   ├── backup/               # 备份相关组件
│   │   ├── restore/              # 恢复相关组件
│   │   └── config/               # 配置相关组件
│   ├── lib/tauri.ts              # Tauri API 封装（重要！）
│   ├── stores/backup-store.ts    # Zustand 状态管理
│   └── types/index.ts            # TypeScript 类型定义
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── lib.rs               # Tauri 应用入口
│   │   ├── commands/
│   │   │   ├── config.rs        # 配置读取命令
│   │   │   ├── backup.rs         # 备份命令
│   │   │   └── restore.rs       # 恢复命令
│   │   └── models.rs            # 数据模型
│   └── scripts/                   # 预制配置文件（编译时嵌入）
│       ├── back_path_windows.txt  # Windows 预制路径配置
│       └── back_path_mac.txt      # macOS 预制路径配置
```

## 关键设计决策

### 1. 配置文件嵌入方式

**配置文件使用 `include_str!` 宏嵌入到 Rust 二进制中**，在编译时读取。

```rust
// src-tauri/src/commands/config.rs
#[tauri::command]
pub fn read_backup_config() -> Result<Vec<BackupPath>, String> {
    let content: &'static str = if cfg!(windows) {
        include_str!("../../../config/back_path_windows.txt")
    } else {
        include_str!("../../../config/back_path_mac.txt")
    };
    // ...
}
```

### 2. 路径解析（~ 展开）

后端 `resolve_path` 函数负责展开 `~` 为用户目录：

```rust
fn resolve_path(path: &str) -> PathBuf {
    let mut p = path.to_string();
    if p.starts_with('~') {
        if let Ok(home) = std::env::var("USERPROFILE") {
            p = p.replacen('~', &home, 1);
        }
    }
    PathBuf::from(p)
}
```

### 3. 分类逻辑

路径分类在 `categorize_path` 函数中定义：

- `iflow`, `codebuddy` → AI Tools
- `claude`, `cursor`, `windsurf`, `ollama`, `kode` 等 → AI Tools
- `git`, `ssh` → Git/SSH
- `vscode`, `npm`, `config`, `yarn`, `docker` → Dev Config
- `obsidian`, `zsh`, `bash` → Shell/Notes
- 未匹配 → None（前端显示为"未分类"）

### 4. Tauri API 调用

前端通过 `src/lib/tauri.ts` 调用 Rust 命令：

```typescript
// 直接使用动态导入的 Tauri API
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

export async function readBackupConfig(): Promise<BackupPath[]> {
  return invoke<BackupPath[]>("read_backup_config")
}
```

### 5. 字段命名规范

**Rust 使用 snake_case，TypeScript 使用 snake_case（保持一致）**：

```rust
// Rust
pub struct BackupPath {
    pub path: String,
    pub resolved: String,
    pub exists: bool,
    pub is_directory: bool,
    pub category: Option<String>,
}
```

```typescript
// TypeScript（必须与 Rust 一致！）
export interface BackupPath {
  path: string;
  resolved: string;
  exists: boolean;
  is_directory: boolean;
  category?: string;
}
```

## 已实现功能

| 功能 | 状态 |
|------|------|
| 从预制 txt 读取配置 | ✅ |
| 按分类显示路径 | ✅ |
| 用户添加自定义路径 | ✅ |
| 勾选/取消勾选路径 | ✅ |
| 备份到 ZIP 文件 | ✅ |
| 从 ZIP 恢复文件 | ✅ |
| 进度显示 | ✅ |
| 分类折叠/展开 | ✅ |

## 构建命令

```bash
# 开发模式
npm run tauri:dev

# 生产构建
npm run tauri:build

# 前端单独构建
npm run build
```

## 输出文件

- `src-tauri/target/release/app.exe` - 可执行文件
- `src-tauri/target/release/bundle/nsis/*.exe` - NSIS 安装包
- `src-tauri/target/release/bundle/msi/*.msi` - MSI 安装包

## 注意事项

1. **纯网页模式不支持** - 此应用专为 Tauri 桌面环境设计，Tauri API 在浏览器中不可用
2. **修改预制配置需重新编译** - 配置文件编译时嵌入，运行时不可修改
3. **~ 路径自动展开** - 后端自动将 `~/.config` 展开为 `C:\Users\用户名\.config`
