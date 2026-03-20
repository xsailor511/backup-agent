# BackupAgent

基于 **Tauri v2** + **Next.js 16** + **TypeScript** + **Tailwind CSS** + **shadcn/ui** 的桌面备份工具。

## 功能特性

| 功能 | 状态 |
|------|------|
| 从预制配置文件读取备份路径 | ✅ |
| 按分类显示路径（AI Tools、Git/SSH、开发配置等） | ✅ |
| 用户添加自定义备份路径 | ✅ |
| 勾选/取消勾选路径 | ✅ |
| 备份到 ZIP 文件 | ✅ |
| 从 ZIP 压缩包恢复文件 | ✅ |
| 实时进度显示 | ✅ |
| 分类折叠/展开 | ✅ |

## 技术栈

- **Tauri v2** - Rust 后端，体积小、性能高
- **Next.js 16** - React 框架（App Router）
- **TypeScript** - 类型安全
- **Tailwind CSS** + **shadcn/ui** - 现代 UI 组件库
- **Zustand** - 轻量级状态管理

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
│   ├── lib/tauri.ts              # Tauri API 封装
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
│       ├── back_path_windows.txt  # Windows 预制路径
│       └── back_path_mac.txt      # macOS 预制路径
└── config/                       # 备份配置文件
```

## 关键设计

### 1. 配置文件嵌入方式

配置文件使用 `include_str!` 宏嵌入到 Rust 二进制中，编译时读取：

```rust
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

后端自动将 `~` 展开为用户目录路径：

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

### 3. 路径分类规则

| 关键词 | 分类 |
|--------|------|
| iflow, codebuddy, claude, cursor, windsurf, ollama, kode | AI Tools |
| git, ssh | Git/SSH |
| vscode, npm, config, yarn, docker | Dev Config |
| obsidian, zsh, bash | Shell/Notes |

### 4. 字段命名规范

Rust 使用 snake_case，TypeScript 保持一致：

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

## 快速开始

### 前置要求

- Node.js 18+
- Rust 1.70+
- npm / pnpm / yarn / bun

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 开发模式

```bash
npm run tauri:dev
```

### 生产构建

```bash
npm run tauri:build
```

### 输出文件

- `src-tauri/target/release/app.exe` - 可执行文件
- `src-tauri/target/release/bundle/nsis/*.exe` - NSIS 安装包
- `src-tauri/target/release/bundle/msi/*.msi` - MSI 安装包

## 注意事项

1. **纯网页模式不支持** - 此应用专为 Tauri 桌面环境设计，Tauri API 在浏览器中不可用
2. **修改预制配置需重新编译** - 配置文件编译时嵌入，运行时不可修改
3. **~ 路径自动展开** - 后端自动将 `~/.config` 展开为 `C:\Users\用户名\.config`
