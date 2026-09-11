$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$testOutput = Join-Path (Split-Path -Parent $PSScriptRoot) 'output'
New-Item -ItemType Directory -Path $testOutput -Force | Out-Null
$testVoice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $testVoice.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet, [System.Speech.Synthesis.VoiceAge]::NotSet, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-US'))
    $testVoice.SetOutputToWaveFile((Join-Path $testOutput 'sample.wav'))
    $testVoice.Speak('Hello, this is a voice recognition test. The keyboard software converts speech into text.')
} finally { $testVoice.Dispose() }
