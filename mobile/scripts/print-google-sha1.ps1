# Prints how to obtain SHA-1 fingerprints for Firebase Google Sign-In.
# Usage: from mobile/  .\scripts\print-google-sha1.ps1

Write-Host ""
Write-Host "=== Google Sign-In SHA-1 setup (com.allconnect.app) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "DEVELOPER_ERROR = SHA-1 of the signing cert is missing in Firebase."
Write-Host ""
Write-Host "1. Play Store installs (REQUIRED for production):" -ForegroundColor Yellow
Write-Host "   Play Console -> Setup -> App integrity -> App signing key certificate -> SHA-1"
Write-Host "   Add that SHA-1 in Firebase -> Project settings -> Android app -> Add fingerprint"
Write-Host ""
Write-Host "2. EAS upload keystore:" -ForegroundColor Yellow
Write-Host "   cd mobile"
Write-Host "   npx eas credentials -p android"
Write-Host "   (open Keystore -> copy SHA-1 -> add in Firebase)"
Write-Host ""
Write-Host "3. Download google-services.json from Firebase -> save as mobile/google-services.json"
Write-Host ""
Write-Host "4. Rebuild: eas build --platform android --profile production"
Write-Host ""
Write-Host "Full guide: mobile/GOOGLE_SIGNIN_SETUP.md"
Write-Host ""

if (Get-Command npx -ErrorAction SilentlyContinue) {
  Write-Host "Opening EAS credentials (interactive)..." -ForegroundColor Green
  Set-Location (Join-Path $PSScriptRoot "..")
  npx eas credentials -p android
}
