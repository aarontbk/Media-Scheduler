<#
.SYNOPSIS
    Deploy Media Scheduler to the remote Docker host.
.DESCRIPTION
    Syncs the local repository to aaron@media:/home/aaron/media-scheduler
    and runs docker compose up --build.
#>

param(
    [string]$RemoteHost = "aaron@media",
    [string]$RemotePath = "/home/aaron/media-scheduler",
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Media Scheduler - Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script/project directory
$ProjectDir = $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = Get-Location }

Write-Host "[1/3] Syncing files to ${RemoteHost}:${RemotePath}..." -ForegroundColor Yellow

# Create remote directory
ssh $RemoteHost "mkdir -p $RemotePath"

# Use scp to sync (rsync preferred if available)
$rsyncAvailable = $null
try {
    $rsyncAvailable = Get-Command rsync -ErrorAction SilentlyContinue
} catch {}

if ($rsyncAvailable) {
    # Convert Windows path to rsync-compatible format
    $rsyncSource = ($ProjectDir -replace '\\', '/') -replace '^([A-Za-z]):', '//$1'
    rsync -avz --delete `
        --exclude '.git' `
        --exclude '__pycache__' `
        --exclude '*.pyc' `
        --exclude '.env' `
        --exclude 'data/' `
        --exclude '.venv' `
        "${rsyncSource}/" "${RemoteHost}:${RemotePath}/"
} else {
    Write-Host "  rsync not found, using scp..." -ForegroundColor Gray
    # Create a temp archive excluding unwanted files
    $tempArchive = Join-Path $env:TEMP "media-scheduler-deploy.tar.gz"
    
    # Use git archive if in a git repo, otherwise tar
    Push-Location $ProjectDir
    try {
        git archive --format=tar.gz --output $tempArchive HEAD
        Write-Host "  Created archive from git HEAD" -ForegroundColor Gray
    } catch {
        Write-Host "  git archive failed, using manual copy" -ForegroundColor Gray
        # Fallback: scp individual directories
        scp -r "$ProjectDir/app" "${RemoteHost}:${RemotePath}/"
        scp -r "$ProjectDir/frontend" "${RemoteHost}:${RemotePath}/"
        scp "$ProjectDir/Dockerfile" "${RemoteHost}:${RemotePath}/"
        scp "$ProjectDir/docker-compose.yml" "${RemoteHost}:${RemotePath}/"
        scp "$ProjectDir/requirements.txt" "${RemoteHost}:${RemotePath}/"
        scp "$ProjectDir/.dockerignore" "${RemoteHost}:${RemotePath}/"
        $tempArchive = $null
    }
    Pop-Location
    
    if ($tempArchive -and (Test-Path $tempArchive)) {
        scp $tempArchive "${RemoteHost}:/tmp/media-scheduler-deploy.tar.gz"
        ssh $RemoteHost "cd $RemotePath && tar -xzf /tmp/media-scheduler-deploy.tar.gz && rm /tmp/media-scheduler-deploy.tar.gz"
        Remove-Item $tempArchive -Force
    }
}

Write-Host "  ✓ Files synced" -ForegroundColor Green
Write-Host ""

# Check if .env exists on remote
Write-Host "[2/3] Checking remote .env..." -ForegroundColor Yellow
$envExists = ssh $RemoteHost "test -f $RemotePath/.env && echo 'yes' || echo 'no'"
if ($envExists.Trim() -eq "no") {
    Write-Host "  ⚠ No .env file found on remote. Copying .env.example..." -ForegroundColor Yellow
    scp "$ProjectDir/.env.example" "${RemoteHost}:${RemotePath}/.env"
    Write-Host "  ⚠ Please edit ${RemotePath}/.env on the remote host before first run!" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ .env exists" -ForegroundColor Green
}
Write-Host ""

# Build and start
Write-Host "[3/3] Building and starting container..." -ForegroundColor Yellow
if ($NoBuild) {
    ssh $RemoteHost "cd $RemotePath && docker compose up -d"
} else {
    ssh $RemoteHost "cd $RemotePath && docker compose up -d --build"
}

Write-Host ""
Write-Host "  ✓ Deployment complete!" -ForegroundColor Green
Write-Host "  Access at: http://media:8081" -ForegroundColor Cyan
Write-Host ""
