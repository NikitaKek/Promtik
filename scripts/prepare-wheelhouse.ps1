$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

$python = "python\.venv\Scripts\python.exe"
$wheelhouse = "python\wheelhouse"

if (-not (Test-Path "python\requirements.txt")) {
  throw "python\requirements.txt was not found."
}

if (-not (Test-Path $python)) {
  throw "python\.venv was not found. Run install-ml.bat or create the venv before preparing wheelhouse."
}

New-Item -ItemType Directory -Force -Path $wheelhouse | Out-Null

$targets = @(
  @{ Version = "3.11"; Abi = "cp311" },
  @{ Version = "3.12"; Abi = "cp312" },
  @{ Version = "3.13"; Abi = "cp313" },
  @{ Version = "3.14"; Abi = "cp314" }
)

foreach ($target in $targets) {
  Write-Host "Downloading wheels for Python $($target.Version) win_amd64..."
  & $python -m pip download `
    --dest $wheelhouse `
    --only-binary=:all: `
    --platform win_amd64 `
    --implementation cp `
    --python-version $target.Version `
    --abi $target.Abi `
    --retries 3 `
    --timeout 120 `
    -r python\requirements.txt

  if ($LASTEXITCODE -ne 0) {
    throw "pip download failed for Python $($target.Version)."
  }
}

Write-Host "Wheelhouse is ready: $wheelhouse"
