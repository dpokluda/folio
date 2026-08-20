#!/usr/bin/env pwsh

<#
.SYNOPSIS
    One-shot build entry point for Folio.

.DESCRIPTION
    Wraps the npm scripts that make up a full rebuild, in the right order:

        [-Clean]     wipe release/          (removes stale artifacts entirely)
        [-Install]   npm install            (only needed after dependency changes)
                     npm run icons          (regenerates icon.* and document.*)
                     npm run dist[:target]  (packages for the target platform)

    Everything here is just orchestration — the actual work lives in the npm
    scripts in package.json, which remain the source of truth and stay usable on
    their own.

    Requires PowerShell 7+ (pwsh), which runs on Windows, macOS and Linux.

.PARAMETER Platform
    Which platform to package for. 'current' (the default) lets electron-builder
    pick the host platform. Naming a platform explicitly cross-targets, which
    generally needs extra tooling (e.g. Wine to build a Windows installer from
    macOS or Linux).

.PARAMETER Install
    Run `npm install` before building. Use after pulling dependency changes.

.PARAMETER Clean
    Delete the whole release/ directory first. Without this, `npm run dist`
    still removes the *-unpacked folder, but leaves older installers behind.

.PARAMETER SkipIcons
    Skip `npm run icons`. The generated .ico/.icns/.png files are committed, so
    they only need rebuilding when build/icons/*.svg changed.

.EXAMPLE
    pwsh scripts/build.ps1
    Regenerate icons and package for the current platform.

.EXAMPLE
    pwsh scripts/build.ps1 -Clean -Install
    Full rebuild from a clean release/ after a dependency change.

.EXAMPLE
    pwsh scripts/build.ps1 -Platform linux
    Cross-target a Linux AppImage + deb.
#>
[CmdletBinding()]
param(
    [ValidateSet('current', 'win', 'mac', 'linux')]
    [string]$Platform = 'current',

    [switch]$Install,
    [switch]$Clean,
    [switch]$SkipIcons
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw "This script needs PowerShell 7+ (pwsh); found $($PSVersionTable.PSVersion)."
}

$repoRoot = Split-Path -Parent $PSScriptRoot

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

# Runs an npm script and turns a non-zero exit code into a terminating error,
# so the build stops at the first failure instead of marching on.
function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    Write-Host "    npm $($Arguments -join ' ')" -ForegroundColor DarkGray
    & npm @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

$distScript = if ($Platform -eq 'current') { 'dist' } else { "dist:$Platform" }
$releaseDir = Join-Path $repoRoot 'release'

Push-Location $repoRoot
try {
    if ($Clean) {
        Write-Step "Cleaning $releaseDir"
        if (Test-Path $releaseDir) {
            try {
                Remove-Item $releaseDir -Recurse -Force
                Write-Host '    removed.'
            }
            catch {
                throw "Could not delete release/ — a file there is locked, " +
                      "most likely a running Folio. Close it and retry. ($($_.Exception.Message))"
            }
        }
        else {
            Write-Host '    nothing to clean.'
        }
    }

    if ($Install) {
        Write-Step 'Installing dependencies'
        Invoke-Npm install
    }

    if (-not $SkipIcons) {
        Write-Step 'Generating icons'
        Invoke-Npm run icons
    }

    Write-Step "Packaging ($distScript)"
    Invoke-Npm run $distScript

    Write-Step 'Done'
    if (Test-Path $releaseDir) {
        Get-ChildItem $releaseDir -File |
            Sort-Object Length -Descending |
            Select-Object -First 10 |
            ForEach-Object {
                '    {0,10:N1} MB  {1}' -f ($_.Length / 1MB), $_.Name
            }
    }
}
finally {
    Pop-Location
}
