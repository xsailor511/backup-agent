#!/bin/bash
# ============================================================
# macOS/Linux 恢复备份脚本
# 用于从备份恢复 AI 开发工具配置和开发环境
# ============================================================

# 默认配置
BACKUP_FILE=""
CONFIG_FILE="back_path_mac.txt"
PREVIEW=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--backup)
            BACKUP_FILE="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -p|--preview)
            PREVIEW=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 -b|--backup <备份文件> [-c|--config <配置文件>] [-p|--preview]"
            exit 1
            ;;
    esac
done

# 检查备份文件是否指定
if [[ -z "$BACKUP_FILE" ]]; then
    echo "错误: 必须指定 -b|--backup 参数"
    echo "用法: $0 -b|--backup <备份文件> [-c|--config <配置文件>] [-p|--preview]"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================
# 日志函数
# ============================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    local log_message="[$timestamp] [$level] $message"
    
    case $level in
        ERROR)
            echo -e "\033[0;31m$log_message\033[0m"
            ;;
        WARN)
            echo -e "\033[0;33m$log_message\033[0m"
            ;;
        SUCCESS)
            echo -e "\033[0;32m$log_message\033[0m"
            ;;
        *)
            echo "$log_message"
            ;;
    esac
}

# ============================================================
# 路径处理函数
# ============================================================

resolve_path() {
    local path="$1"
    
    if [[ "$path" == ~* ]]; then
        path="${path/#\~/$HOME}"
    fi
    
    echo "$path"
}

# ============================================================
# 主恢复逻辑
# ============================================================

echo "========================================"
log "INFO" "macOS/Linux 恢复开始"
echo "========================================"

# 检查备份文件是否存在
if [[ ! -e "$BACKUP_FILE" ]]; then
    log "ERROR" "备份文件不存在: $BACKUP_FILE"
    exit 1
fi

log "INFO" "备份文件: $BACKUP_FILE"

# 解压备份文件到临时目录
TempDir=$(mktemp -d)
trap "rm -rf '$TempDir'" EXIT

mkdir -p "$TempDir"

# 解压备份
if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
    log "INFO" "正在解压备份..."
    tar -xzf "$BACKUP_FILE" -C "$TempDir" 2>/dev/null
else
    # 如果是目录，直接复制
    cp -r "$BACKUP_FILE"/* "$TempDir/" 2>/dev/null
fi

if [[ $? -ne 0 ]]; then
    log "ERROR" "解压失败"
    rm -rf "$TempDir"
    exit 1
fi

# 读取配置文件获取目标路径
TargetPaths=()
if [[ -f "$CONFIG_FILE" ]]; then
    while IFS= read -r line; do
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            line=$(echo "$line" | xargs)
            TargetPaths+=("$line")
        fi
    done < "$CONFIG_FILE"
else
    log "WARN" "配置文件不存在: $CONFIG_FILE，将使用默认路径"
fi

# 列出备份中的内容
BackupItems=("$TempDir"/*)

if [[ "$PREVIEW" == true ]]; then
    log "INFO" "========== 预览模式 =========="
    log "INFO" "备份中包含以下项目:"
    for item in "${BackupItems[@]}"; do
        if [[ -e "$item" ]]; then
            size=$(du -sh "$item" 2>/dev/null | cut -f1)
            basename "$item" | while read name; do
                echo "  - $name ($size)"
            done
        fi
    done
    log "INFO" "=========================="
    
    if [[ ${#TargetPaths[@]} -gt 0 ]]; then
        log "INFO" "将会恢复以下目标路径:"
        for path in "${TargetPaths[@]}"; do
            resolved=$(resolve_path "$path")
            echo "  - $resolved"
        done
    fi
    
    rm -rf "$TempDir"
    log "INFO" "预览完成，未执行实际恢复"
    exit 0
fi

echo "========================================"
log "INFO" "开始恢复..."
echo "========================================"

SuccessCount=0
FailCount=0

# 遍历备份项目并恢复到对应位置
for item in "${BackupItems[@]}"; do
    if [[ ! -e "$item" ]]; then
        continue
    fi
    
    ItemName=$(basename "$item")
    
    # 尝试找到匹配的目标路径
    TargetPath=""
    
    for ConfigPath in "${TargetPaths[@]}"; do
        SafeConfigName=$(echo "$ConfigPath" | sed 's/[<>:\"\/\\|?*]/_/g')
        if [[ "$SafeConfigName" == "$ItemName" ]]; then
            TargetPath=$(resolve_path "$ConfigPath")
            break
        fi
    done
    
    # 如果没找到配置中的对应路径，尝试从原始路径解析
    if [[ -z "$TargetPath" ]]; then
        TargetPath=$(resolve_path "$ItemName")
    fi
    
    # 创建目标父目录
    TargetParent=$(dirname "$TargetPath")
    mkdir -p "$TargetParent"
    
    # 如果目标已存在，先备份原文件
    if [[ -e "$TargetPath" ]]; then
        BackupSuffix=".backup_$(date +%Y%m%d%H%M%S)"
        mv "$TargetPath" "$TargetPath$BackupSuffix" 2>/dev/null
        log "WARN" "已备份原文件: $TargetPath"
    fi
    
    # 恢复文件/目录
    if [[ -d "$item" ]]; then
        cp -r "$item" "$TargetPath" 2>/dev/null
        result=$?
    else
        cp "$item" "$TargetPath" 2>/dev/null
        result=$?
    fi
    
    if [[ $result -eq 0 ]]; then
        log "SUCCESS" "恢复成功: $ItemName -> $TargetPath"
        ((SuccessCount++))
    else
        log "ERROR" "恢复失败: $ItemName"
        ((FailCount++))
    fi
done

# 清理临时目录
rm -rf "$TempDir"

# ============================================================
# 输出恢复摘要
# ============================================================

echo "========================================"
log "INFO" "恢复完成！"
echo "========================================"
log "SUCCESS" "成功: $SuccessCount"
if [[ $FailCount -gt 0 ]]; then
    log "ERROR" "失败: $FailCount"
else
    log "SUCCESS" "失败: $FailCount"
fi
echo "========================================"

if [[ $FailCount -gt 0 ]]; then
    echo -e "\033[0;33m部分项目恢复失败，请检查上述错误信息\033[0m"
fi

exit $([[ $FailCount -gt 0 ]] && echo 1 || echo 0)
