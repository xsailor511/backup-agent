# ============================================================
# Windows Backup Script
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$OutputDir,
    [string]$ConfigFile = "back_path_windows.txt",
    [switch]$ShowDetails = $false
)

$ErrorActionPreference = "Continue"

# ============================================================
# Init
# ============================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupDir = $OutputDir

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$LogFile = Join-Path $BackupDir "backup_log_$Timestamp.txt"
$BackupName = "backup_$Timestamp"

# Ensure backup dir exists
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

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
    
    Add-Content -Path $LogFile -Value $LogMsg -Encoding UTF8
}

# ============================================================
# Path Resolution
# ============================================================

function Resolve-BackupPath {
    param([string]$Path)
    
    # Handle ~
    if ($Path -like "~*") {
        $Path = $Path -replace '^~', $env:USERPROFILE
    }
    
    # Handle env variables
    if ($Path -like '%*%') {
        $Path = [System.Environment]::ExpandEnvironmentVariables($Path)
    }
    
    return $Path
}

# ============================================================
# Main Backup Logic
# ============================================================

Write-Log "========================================" "INFO"
Write-Log "Windows Backup Started" "INFO"
Write-Log "Output Dir: $BackupDir" "INFO"
Write-Log "Config File: $ConfigFile" "INFO"
Write-Log "========================================" "INFO"

# Check config file
if (-not (Test-Path $ConfigFile)) {
    Write-Log "Config file not found: $ConfigFile" "ERROR"
    exit 1
}

# Read config
$Paths = @()
Get-Content $ConfigFile | ForEach-Object {
    $Line = $_.Trim()
    if (-not [string]::IsNullOrWhiteSpace($Line) -and -not $Line.StartsWith("#")) {
        $Paths += $Line
    }
}

$TotalPaths = $Paths.Count
$SuccessCount = 0
$FailCount = 0
$SkippedCount = 0

Write-Log "Found $TotalPaths paths to backup" "INFO"
Write-Log "========================================" "INFO"

# Create temp dir
$TempDir = Join-Path $env:TEMP "backup_temp_$Timestamp"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

# Backup each path
for ($i = 0; $i -lt $Paths.Count; $i++) {
    $OriginalPath = $Paths[$i]
    $ResolvedPath = Resolve-BackupPath $OriginalPath
    
    $CurrentIndex = $i + 1
    $pct = [math]::Round(($CurrentIndex / $TotalPaths) * 100, 1)
    
    Write-Host "`rBackup: $CurrentIndex/$TotalPaths ($pct) - $OriginalPath" -NoNewline
    
    # Check if path exists
    if (-not (Test-Path $ResolvedPath)) {
        Write-Log "Path not found, skip: $ResolvedPath" "WARN"
        $SkippedCount++
        continue
    }
    
    # Create safe name
    $SafeName = $OriginalPath -replace '[<>:"/\\|?*]', '_'
    $DestDir = Join-Path $TempDir $SafeName
    
    try {
        if (Test-Path $ResolvedPath -PathType Leaf) {
            $DestFile = Join-Path $TempDir "$SafeName"
            Copy-Item -Path $ResolvedPath -Destination $DestFile -Force
        } else {
            Copy-Item -Path $ResolvedPath -Destination $DestDir -Recurse -Force
        }
        
        Write-Log "Success: $OriginalPath" "SUCCESS"
        $SuccessCount++
    }
    catch {
        Write-Log "Failed: $OriginalPath - $($_.Exception.Message)" "ERROR"
        $FailCount++
    }
}

Write-Host ""

# ============================================================
# Create Archive
# ============================================================

Write-Log "========================================" "INFO"
Write-Log "Creating archive..." "INFO"

$ZipPath = Join-Path $BackupDir "$BackupName.zip"

try {
    Compress-Archive -Path "$TempDir\*" -DestinationPath $ZipPath -Force
    
    $ZipSize = (Get-Item $ZipPath).Length / 1MB
    $ZipSize = [math]::Round($ZipSize, 2)
    
    Write-Log "Archive created: $ZipPath ($ZipSize MB)" "SUCCESS"
}
catch {
    Write-Log "Archive failed: $($_.Exception.Message)" "ERROR"
    $ZipPath = $TempDir
}

Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# ============================================================
# Summary
# ============================================================

Write-Log "========================================" "INFO"
Write-Log "Backup Complete!" "INFO"
Write-Log "========================================" "INFO"
Write-Log "Total: $TotalPaths" "INFO"
Write-Log "Success: $SuccessCount" "SUCCESS"
Write-Log "Skipped: $SkippedCount" "WARN"
if ($FailCount -gt 0) { 
    Write-Log "Failed: $FailCount" "ERROR" 
} else { 
    Write-Log "Failed: $FailCount" "SUCCESS" 
}
Write-Log "Output: $BackupDir" "INFO"
Write-Log "Archive: $ZipPath" "INFO"
Write-Log "Log: $LogFile" "INFO"
Write-Log "========================================" "INFO"

if ($FailCount -gt 0) {
    Write-Host "Check log for failed items: $LogFile" -ForegroundColor Yellow
}

exit $(if ($FailCount -gt 0) { 1 } else { 0 })
