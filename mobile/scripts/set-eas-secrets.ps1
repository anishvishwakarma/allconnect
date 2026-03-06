# Run from mobile/ folder after updating .env with your new API key.
# Usage: .\scripts\set-eas-secrets.ps1
# Requires: npx eas-cli logged in

$envFile = Join-Path $PSScriptRoot ".." ".env"
if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
  exit 1
}

$vars = @(
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID"
)

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.+)\s*$') {
    $name = $matches[1]
    $value = $matches[2].Trim().Trim('"').Trim("'")
    if ($name -in $vars -and $value -and $value -notmatch '^YOUR_|^<\w+>$') {
      Write-Host "Setting EAS secret: $name"
      & npx eas-cli secret:create --scope project --name $name --value $value --type string --force 2>&1
    }
  }
}

Write-Host "Done. Run: npx eas-cli build --platform android --profile production"
