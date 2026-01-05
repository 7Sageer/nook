$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$includeDir = Join-Path $scriptDir "include"
$zipPath = Join-Path $scriptDir "sqlite-amalgamation.zip"
$extractDir = Join-Path $scriptDir "sqlite_temp"

# Clean up previous attempts if needed (optional but good for retry)
if (Test-Path $includeDir) { Remove-Item -Recurse -Force $includeDir }
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }

New-Item -ItemType Directory -Path $includeDir | Out-Null

Write-Host "Downloading SQLite 3.46.1 amalgamation..."
try {
    # SQLite 3.46.1 = 3460100
    Invoke-WebRequest -Uri "https://www.sqlite.org/2024/sqlite-amalgamation-3460100.zip" -OutFile $zipPath
}
catch {
    Write-Error "Failed to download SQLite amalgamation: $_"
    exit 1
}

Write-Host "Extracting SQLite amalgamation..."
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

$sourceDir = Join-Path $extractDir "sqlite-amalgamation-3460100"
Copy-Item (Join-Path $sourceDir "sqlite3.h") -Destination $includeDir
Copy-Item (Join-Path $sourceDir "sqlite3.c") -Destination $includeDir

Write-Host "SQLite headers extracted to $includeDir"

# Cleanup
Remove-Item -Force $zipPath
Remove-Item -Recurse -Force $extractDir

# set CGO_CFLAGS
$env:CGO_CFLAGS = "-I$includeDir"
Write-Host "Set CGO_CFLAGS to: $env:CGO_CFLAGS"

# Make available to subsequent GitHub Actions steps
if ($env:GITHUB_ENV) {
    "CGO_CFLAGS=-I$includeDir" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
    Write-Host "Exported CGO_CFLAGS to GITHUB_ENV"
}

# 获取版本信息
Write-Host "Reading version info..."
$version = git describe --tags --always --dirty 2>$null
if (-not $version) { $version = "dev" }

$buildTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss UTC")
$gitCommit = git rev-parse --short HEAD 2>$null
if (-not $gitCommit) { $gitCommit = "unknown" }

Write-Host "Version:    $version"
Write-Host "BuildTime:  $buildTime"
Write-Host "GitCommit:  $gitCommit"

# 构建 ldflags
$ldflags = "-X 'main.Version=$version' -X 'main.BuildTime=$buildTime' -X 'main.GitCommit=$gitCommit'"

# 同步版本号到 wails.json
Write-Host "Syncing version to wails.json..."
try {
    $wailsConfig = Get-Content "wails.json" -Raw | ConvertFrom-Json
    $wailsConfig.info.productVersion = $version
    $wailsConfig | ConvertTo-Json -Depth 10 | Set-Content "wails.json"
    Write-Host "✓ wails.json updated to version: $version"
}
catch {
    Write-Host "⚠ Warning: Failed to update wails.json: $_"
}
Write-Host ""

# run wails build with NSIS installer
Write-Host "Running wails build with version info and NSIS installer..."
wails build -ldflags $ldflags -nsis

# Build MCP server
Write-Host "Building MCP server..."
go build -ldflags $ldflags -o build/bin/nook-mcp.exe ./cmd/mcp-server
Write-Host "MCP server built successfully"
