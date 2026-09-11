$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    python -m venv (Join-Path $projectRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.10+ is required. Install Python and retry.' }
}
& $venvPython -m pip install -r (Join-Path $projectRoot 'engine/requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Engine dependency installation failed. Check network access and retry.' }
& $venvPython -c 'from faster_whisper import WhisperModel; print(WhisperModel.__name__)'
if ($LASTEXITCODE -ne 0) { throw 'Engine import failed.' }
Write-Host 'Ready. Run npm run dev. Models download when you click Load model.'
