[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

if (-not $IsWindows -or $env:GITHUB_ACTIONS -cne 'true' -or
    -not $env:RUNNER_TEMP -or -not $env:GITHUB_ENV) {
    throw 'This compiler provisioning script is only for a Windows GitHub Actions job.'
}

$version = '6.7.3'
$expectedHash = '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732'
$uri = "https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-$version.exe"
$directory = Join-Path $env:RUNNER_TEMP ("folio-inno-" + [Guid]::NewGuid().ToString('N'))
$download = Join-Path $directory "innosetup-$version.exe"
$destination = Join-Path $directory 'compiler'
New-Item -ItemType Directory -Path $directory | Out-Null

Invoke-WebRequest -Uri $uri -OutFile $download -MaximumRetryCount 3 -RetryIntervalSec 2
$hash = (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -cne $expectedHash) {
    throw "Inno Setup $version download has an unexpected SHA-256 digest. It will not be executed."
}
$signature = Get-AuthenticodeSignature -LiteralPath $download
if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate) {
    throw "Inno Setup $version has no valid Authenticode signature. It will not be executed."
}
$publisher = $signature.SignerCertificate.GetNameInfo(
    [System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
if ($publisher -cne 'Pyrsys B.V.') {
    throw "Inno Setup $version has an unexpected publisher: $publisher"
}

$arguments = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CURRENTUSER', "/DIR=`"$destination`"")
$process = Start-Process -FilePath $download -ArgumentList $arguments -PassThru
if (-not $process.WaitForExit(180000)) {
    Stop-Process -Id $process.Id -Force
    throw 'The owned Inno Setup compiler installer exceeded its three-minute deadline.'
}
if ($process.ExitCode -ne 0) {
    throw "Inno Setup compiler installation failed with exit code $($process.ExitCode)."
}
$compiler = Join-Path $destination 'ISCC.exe'
$actualVersion = (Get-Item -LiteralPath $compiler).VersionInfo.FileVersion
if ($actualVersion.Trim() -notmatch '^6\.7\.3(?:\.0)?$') {
    throw "Expected compiler $version; installed compiler reports $actualVersion."
}
Add-Content -LiteralPath $env:GITHUB_ENV -Value "ISCC_PATH=$compiler" -Encoding utf8
Remove-Item -LiteralPath $download -Force
Write-Host "Verified Inno Setup $version is ready in the owned runner-temporary directory."
