$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repo = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json
$archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $repo 'release\ForgeNotes-Recorder-Setup.appx'))
try {
  $entry = $archive.GetEntry('AppxManifest.xml')
  if (-not $entry) { throw 'APPX manifest missing' }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
  $identity = $manifest.Package.Identity
  $version = [version]$identity.Version
  if ($version.Major -lt 1 -or $version.Revision -ne 0) { throw "Store version must have a nonzero major and zero revision: $version" }
  if ($identity.Version -ne "$($package.version).0") { throw 'Store version does not match package.json' }
  if ($identity.Name -ne $package.build.appx.identityName -or $identity.Publisher -ne $package.build.appx.publisher) { throw 'Store identity does not match package.json' }
  if ($identity.ProcessorArchitecture -ne 'x64') { throw 'Expected x64 Store package' }
  Write-Output "Store manifest verified: $($identity.Name), $version, x64."
} finally { $archive.Dispose() }
