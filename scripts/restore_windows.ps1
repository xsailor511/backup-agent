# ============================================================
# Windows Restore Script
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ConfigFile = "back_path_windows.txt",
    [switch]$Preview = $false
)

$ErrorActionPreference = "Continue"

# ============================================================
# Init
# ============================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ============================================================
# Log Function
# ============================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMsg = "[$ts] [$Level] $Message"
    
    switch ($Level) {
        "ERROR" { Write-Host $LogMsg -ForegroundColor Red }
        "WARN"  { Write-Host $LogMsg -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $LogMsg -ForegroundColor Green }
        default { Write-Host $LogMsg }
    }
}

# ============================================================
# Path Resolution
# ============================================================

function Resolve-TargetPath {
    param([string]$Path)
    
    if ($Path -like "~*") {
        $Path = $Path -replace '^~', $env:USERPROFILE
    }
    
    if ($Path -like '%*%') {
        $Path = [System.Environment]::ExpandEnvironmentVariables($Path)
    }
    
    return $Path
}

# ============================================================
# Main Restore Logic
# ============================================================

Write-Log "========================================" "INFO"
Write-Log "Windows Restore Started" "INFO"
Write-Log "========================================" "INFO"

# Check backup file
if (-not (Test-Path $BackupFile)) {
    Write-Log "Backup file not found: $BackupFile" "ERROR"
    exit 1
}

Write-Log "Backup file: $BackupFile" "INFO"

# Extract to temp dir
$TempDir = Join-Path $env:TEMP "restore_temp_$(Get-Date -Format 'yyyyMMddHHmmss')"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    if ($BackupFile -match '\.zip$') {
        Write-Log "Extracting backup..." "INFO"
        Expand-Archive -Path $BackupFile -DestinationPath $TempDir -Force
    } else {
        Copy-Item -Path $BackupFile -Destination $TempDir -Recurse -Force
    }
}
catch {
    Write-Log "Extract failed: $($_.Exception.Message)" "ERROR"
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# Read config for target paths
if (-not (Test-Path $ConfigFile)) {
    Write-Log "Config file not found: $ConfigFile, using default paths" "WARN"
    $ConfigFile = $null
}

$TargetPaths = @()
if ($ConfigFile) {
    Get-Content $ConfigFile | ForEach-Object {
        $Line = $_.Trim()
        if (-not [string]::IsNullOrWhiteSpace($Line) -and -not $Line.StartsWith("#")) {
            $TargetPaths += $Line
        }
    }
}

# List backup contents
$BackupItems = Get-ChildItem -Path $TempDir -ErrorAction SilentlyContinue

if ($Preview) {
    Write-Log "========== PREVIEW MODE ==========" "INFO"
    Write-Log "Backup contains:" "INFO"
    foreach ($Item in $BackupItems) {
        $Size = if ($Item.PSIsContainer) { 
            (Get-ChildItem -Path $Item.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum 
        } else { 
            $Item.Length 
        }
        $SizeMB = [math]::Round($Size / 1MB, 2)
        Write-Host "  - $($Item.Name) ($SizeMB MB)"
    }
    Write-Log "==========================" "INFO"
    
    if ($TargetPaths.Count -gt 0) {
        Write-Log "Will restore to:" "INFO"
        foreach ($Path in $TargetPaths) {
            Write-Host "  - $(Resolve-TargetPath $Path)"
        }
    }
    
    Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Log "Preview complete, no actual restore performed" "INFO"
    exit 0
}

Write-Log "========================================" "INFO"
Write-Log "Starting restore..." "INFO"
Write-Log "========================================" "INFO"

$SuccessCount = 0
$FailCount = 0

# Restore each item
foreach ($Item in $BackupItems) {
    $ItemName = $Item.Name
    
    $TargetPath = $null
    
    foreach ($ConfigPath in $TargetPaths) {
        $SafeConfigName = $ConfigPath -replace '[<>:"/\\|?*]', '_'
        if ($SafeConfigName -eq $ItemName) {
            $TargetPath = Resolve-TargetPath $ConfigPath
            break
        }
    }
    
    if (-not $TargetPath) {
        $ResolvedOriginal = Resolve-TargetPath $ItemName
        $TargetPath = $ResolvedOriginal
    }
    
    $TargetParent = Split-Path -Parent $TargetPath
    if (-not (Test-Path $TargetParent)) {
        New-Item -ItemType Directory -Path $TargetParent -Force | Out-Null
    }
    
    try {
        if (Test-Path $TargetPath) {
            $BackupSuffix = ".backup_$(Get-Date -Format 'yyyyMMddHHmmss')"
            Rename-Item -Path $TargetPath -NewName "$($Item.Name)$BackupSuffix" -Force
            Write-Log "Backed up existing: $TargetPath" "WARN"
        }
        
        if ($Item.PSIsContainer) {
            Copy-Item -Path $Item.FullName -Destination $TargetPath -Recurse -Force
        } else {
            Copy-Item -Path $Item.FullName -Destination $TargetPath -Force
        }
        
        Write-Log "Restored: $ItemName -> $TargetPath" "SUCCESS"
        $SuccessCount++
    }
    catch {
        Write-Log "Failed: $ItemName - $($_.Exception.Message)" "ERROR"
        $FailCount++
    }
}

Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# ============================================================
# Summary
# ============================================================

Write-Log "========================================" "INFO"
Write-Log "Restore Complete!" "INFO"
Write-Log "========================================" "INFO"
Write-Log "Success: $SuccessCount" "SUCCESS"
if ($FailCount -gt 0) { 
    Write-Log "Failed: $FailCount" "ERROR" 
} else { 
    Write-Log "Failed: $FailCount" "SUCCESS" 
}
Write-Log "========================================" "INFO"

if ($FailCount -gt 0) {
    Write-Host "Some items failed to restore" -ForegroundColor Yellow
}

exit $(if ($FailCount -gt 0) { 1 } else { 0 })
