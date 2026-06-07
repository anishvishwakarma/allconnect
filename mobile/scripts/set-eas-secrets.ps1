# Sync mobile/.env EXPO_PUBLIC_* vars to EAS project environment variables.
# Usage (from mobile/): .\scripts\set-eas-secrets.ps1
# Requires: npx eas-cli logged in

$envFile = Join-Path (Join-Path $PSScriptRoot "..") ".env"
if (-not (Test-Path $envFile)) {
  Write-Error ".env not found at $envFile"
  exit 1
}

$vars = @(
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
  "EXPO_PUBLIC_USE_MOCK_OTP",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"
)

$environments = @("production", "preview")

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.+)\s*$') {
    $name = $matches[1]
    $value = $matches[2].Trim().Trim('"').Trim("'")
    if ($name -in $vars -and $value -and $value -notmatch '^YOUR_|^<\w+>$') {
      foreach ($envName in $environments) {
        Write-Host "EAS env: $name -> $envName"
        & npx --yes eas-cli@latest env:create `
          --name $name `
          --value $value `
          --environment $envName `
          --visibility plaintext `
          --scope project `
          --force `
          --non-interactive 2>&1
      }
    }
  }
}

Write-Host "Done. Production builds will use EXPO_PUBLIC_API_URL from EAS + eas.json."
