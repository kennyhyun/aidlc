---
name: remote-powershell
description: Use when you need to execute PowerShell commands or scripts on Windows host from Linux VM with administrator privileges
---

# Remote PowerShell Execution

## Overview

Execute PowerShell commands on Windows host with administrator privileges from Linux VM using SSH + Task Scheduler.

## When to Use

Use when you need to:
- Run Windows executables from Linux VM
- Execute PowerShell commands with admin rights
- Test Windows-specific functionality without switching environments
- Automate Windows tasks from Linux development environment

Do NOT use when:
- Command can run without admin privileges (use SSH directly)
- Need concurrent execution (system uses single command.txt file)
- Need GUI interaction (runs in background)

## Prerequisites

**Required:**
- `WINDOWS_HOST` environment variable set
- `WINDOWS_USER` environment variable set
- SSH access to Windows host
- Task Scheduler configured (see Setup section)

**Setup (one-time):**

```bash
# 1. Deploy scripts from Linux
cd ~/Projects/aidlc
bash scripts/deploy-windows-remote.sh

# 2. Run on Windows as Administrator
cd $env:USERPROFILE\AppData\Local\Programs\reimagine-kiosk\remotescript
.\setup-remote-executor.ps1

# 3. Test from Linux
export WINDOWS_HOST=WindowsHostname WINDOWS_USER=Username
bash scripts/test/poc-windows-remote.sh
```

## Quick Reference

### Execute Command

```bash
./scripts/run-windows.sh command "Write-Host 'Hello'"
./scripts/run-windows.sh command "Get-Process" --timeout 60
./scripts/run-windows.sh command "whoami" --verbose
```

### Execute Script File

```bash
./scripts/run-windows.sh script ./my-script.ps1
./scripts/run-windows.sh script ./my-script.ps1 --timeout 120
```

### Run Windows Executable

```bash
# Copy to Windows-accessible location first
cp myapp.exe /vagrant/

# Create and run PowerShell script
cat > /vagrant/run-myapp.ps1 << 'EOF'
$exePath = "$env:USERPROFILE\AppData\Local\Programs\reimagine-kiosk\myapp.exe"
if (Test-Path $exePath) {
    & $exePath
} else {
    Write-Error "Executable not found at $exePath"
    exit 1
}
EOF

./scripts/run-windows.sh script /vagrant/run-myapp.ps1
```

## Common Patterns

### Check File Exists

```bash
./scripts/run-windows.sh command "Test-Path 'C:\path\to\file.exe'"
```

### List Directory

```bash
./scripts/run-windows.sh command "Get-ChildItem 'C:\path' | Select-Object Name"
```

### Copy and Execute

```bash
# 1. Copy file to shared location
mkdir -p /vagrant/data/temp/
cp myfile.exe /vagrant/data/temp/

# 2. Create wrapper script
cat > /vagrant/run-wrapper.ps1 << 'EOF'
$kioskDir = "$env:USERPROFILE\AppData\Local\Programs\reimagine-kiosk"
$sourceFile = "$kioskDir\data\temp\myfile.exe"

if (Test-Path $sourceFile) {
    Write-Host "Executing $sourceFile"
    & $sourceFile
} else {
    Write-Error "File not found: $sourceFile"
    exit 1
}
EOF

# 3. Execute
./scripts/run-windows.sh script /vagrant/run-wrapper.ps1
```

## Result Format

Output is JSON:

```json
{
  "output": "Command execution result\r\n",
  "exitCode": 0,
  "timestamp": "2026-02-21 22:54:25",
  "success": true
}
```

## Limitations

- **No concurrent execution**: command.txt is overwritten
- **Background execution**: GUI apps run without display
- **Execution delay**: ~1-2 seconds for Task Scheduler
- **Shared folder access**: Files must be in Windows-accessible paths

## Troubleshooting

### SSH Connection Failed

```bash
ssh $WINDOWS_HOST echo test
```

### Task Scheduler Not Running

```bash
./scripts/run-windows.sh command "schtasks /query /tn RemoteExecutor /v /fo list"
```

### File Not Found on Windows

Windows can't access Linux paths directly. Use shared folder:

```bash
# ❌ BAD: Linux path
./scripts/run-windows.sh command "& '/home/user/file.exe'"

# ✅ GOOD: Shared folder
cp file.exe /vagrant/
./scripts/run-windows.sh command "& '$env:USERPROFILE\AppData\Local\Programs\reimagine-kiosk\file.exe'"
```

### Reinstall

```bash
# Linux: Redeploy
bash scripts/deploy-windows-remote.sh

# Windows: Reinstall (as Administrator)
cd $env:USERPROFILE\AppData\Local\Programs\reimagine-kiosk\remotescript
.\setup-remote-executor.ps1
```

## Environment Variables

Configure in `.zshrc` or `.bashrc`:

```bash
export WINDOWS_HOST=WindowsHostname
export WINDOWS_USER=Username
```

## File Locations

**Linux VM:**
- Scripts: `aidlc/scripts/run-windows.sh`
- Shared folder: `/vagrant/remotescript/`

**Windows Host:**
- Shared folder: `%USERPROFILE%\AppData\Local\Programs\reimagine-kiosk\remotescript\`
- Execution script: `remote-executor.ps1`
- Task Scheduler: `RemoteExecutor` (HIGHEST privilege)

## Related Documentation

- [Windows Remote Scripting](../../docs/windows-remote-scripting.md) - Complete architecture and setup
- [Function Library](../../scripts/lib/windows-remote.sh) - Bash functions for scripting
