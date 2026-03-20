#!/bin/bash
# ============================================================
# macOS/Linux 备份脚本
# 用于备份 AI 开发工具配置和开发环境
# ============================================================

# 默认配置
CONFIG_FILE="back_path_mac.txt"
OUTPUT_DIR=""
VERBOSE=false
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --output_dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "用法: $0 --output_dir <输出目录> [-c|--config <配置文件>] [-v|--verbose]"
            exit 1
            ;;
    esac
done

# 检查输出目录是否指定
if [[ -z "$OUTPUT_DIR" ]]; then
    echo "错误: 必须指定 --output_dir 参数"
    echo "用法: $0 --output_dir <输出目录> [-c|--config <配置文件>] [-v|--verbose]"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKUP_DIR="$OUTPUT_DIR"

# 设置日志文件
LOG_FILE="$BACKUP_DIR/backup_log_$TIMESTAMP.txt"
BACKUP_NAME="backup_$TIMESTAMP"

# ============================================================
# 日志函数
# ============================================================

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    local log_message="[$timestamp] [$level] $message"
    
    # 输出到控制台
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
    
    # 写入日志文件
    echo "$log_message" >> "$LOG_FILE"
}

# ============================================================
# 路径处理函数
# ============================================================

resolve_path() {
    local path="$1"
    
    # 处理 ~
    if [[ "$path" == ~* ]]; then
        path="${path/#\~/$HOME}"
    fi
    
    echo "$path"
}

# ============================================================
# 主备份逻辑
# ============================================================

echo "========================================"
log "INFO" "macOS/Linux 备份开始"
log "INFO" "输出目录: $BACKUP_DIR"
log "INFO" "配置文件: $CONFIG_FILE"
echo "========================================"

# 检查配置文件是否存在
if [[ ! -f "$CONFIG_FILE" ]]; then
    log "ERROR" "配置文件 $CONFIG_FILE 不存在，请先创建配置文件"
    exit 1
fi

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 读取配置文件
Paths=()
while IFS= read -r line; do
    # 跳过空行和注释
    if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
        # 去除前后空白
        line=$(echo "$line" | xargs)
        Paths+=("$line")
    fi
done < "$CONFIG_FILE"

TotalPaths=${#Paths[@]}
SuccessCount=0
FailCount=0
SkippedCount=0

log "INFO" "共找到 $TotalPaths 个待备份路径"
echo "========================================"

# 创建临时工作目录
TempDir=$(mktemp -d)
trap "rm -rf '$TempDir'" EXIT

# 遍历所有路径进行备份
for ((i=0; i<TotalPaths; i++)); do
    OriginalPath="${Paths[$i]}"
    ResolvedPath=$(resolve_path "$OriginalPath")
    
    # 计算进度
    CurrentIndex=$((i + 1))
    Progress=$(awk "BEGIN {printf \"%.1f\", ($CurrentIndex / $TotalPaths) * 100}")
    
    # 打印进度（不换行）
    printf "\r备份进度: $CurrentIndex / $TotalPaths ($Progress%%) - $OriginalPath"
    
    # 检查路径是否存在
    if [[ ! -e "$ResolvedPath" ]]; then
        log "WARN" "路径不存在，跳过: $ResolvedPath"
        ((SkippedCount++))
        continue
    fi
    
    # 创建安全的子目录名
    SafeName=$(echo "$OriginalPath" | sed 's/[<>:\"\/\\|?*]/_/g')
    DestDir="$TempDir/$SafeName"
    
    # 复制文件/目录
    if [[ -f "$ResolvedPath" ]]; then
        # 是文件
        cp "$ResolvedPath" "$TempDir/$SafeName" 2>/dev/null
        result=$?
    else
        # 是目录
        cp -r "$ResolvedPath" "$DestDir" 2>/dev/null
        result=$?
    fi
    
    if [[ $result -eq 0 ]]; then
        log "SUCCESS" "备份成功: $OriginalPath -> $SafeName"
        ((SuccessCount++))
    else
        log "ERROR" "备份失败: $OriginalPath"
        ((FailCount++))
    fi
done

echo ""  # 换行

# ============================================================
# 创建压缩包
# ============================================================

echo "========================================"
log "INFO" "正在创建压缩包..."

ZipPath="$BACKUP_DIR/$BACKUP_NAME.tar.gz"

# 使用 tar 创建压缩包
tar -czf "$ZipPath" -C "$TempDir" . 2>/dev/null

if [[ $? -eq 0 ]]; then
    ZipSize=$(du -h "$ZipPath" | cut -f1)
    log "SUCCESS" "压缩包创建成功: $ZipPath ($ZipSize)"
else
    log "ERROR" "压缩失败，将保留解压的目录"
    # 如果压缩失败，将临时目录复制过去
    cp -r "$TempDir" "$BACKUP_DIR/$BACKUP_NAME"
    ZipPath="$BACKUP_DIR/$BACKUP_NAME"
fi

# ============================================================
# 输出备份摘要
# ============================================================

echo "========================================"
log "INFO" "备份完成！"
echo "========================================"
log "INFO" "总计: $TotalPaths"
log "SUCCESS" "成功: $SuccessCount"
log "WARN" "跳过: $SkippedCount"
if [[ $FailCount -gt 0 ]]; then
    log "ERROR" "失败: $FailCount"
else
    log "SUCCESS" "失败: $FailCount"
fi
log "INFO" "备份位置: $BACKUP_DIR"
log "INFO" "备份文件: $ZipPath"
log "INFO" "日志文件: $LOG_FILE"
echo "========================================"

# 如果有失败的备份，显示详情
if [[ $FailCount -gt 0 ]]; then
    echo ""
    echo -e "\033[0;33m失败的备份项详情请查看日志文件: $LOG_FILE\033[0m"
fi

exit $([[ $FailCount -gt 0 ]] && echo 1 || echo 0)
