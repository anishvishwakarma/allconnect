# Set EXPO_PUBLIC_* EAS env vars to plaintext visibility (removes "Hidden values" build warning).
# Usage (from mobile/): .\scripts\set-eas-env-plaintext.ps1
# Does not change values — only visibility. Keys stay on EAS, not in GitHub.

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
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"
)

$environments = @("production", "preview")

foreach ($envName in $environments) {
  foreach ($name in $vars) {
    Write-Host "Plaintext: $name ($envName)"
    & npx --yes eas-cli@latest env:update `
      --variable-name $name `
      --variable-environment $envName `
      --visibility plaintext `
      --non-interactive 2>&1
  }
}

Write-Host "Done. Re-run eas build; the hidden-values warning should be gone."
