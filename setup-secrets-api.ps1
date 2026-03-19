param(
    [string]$Repo = "owner/repo",
    [string]$CloudflareApiToken = $env:CLOUDFLARE_API_TOKEN,
    [string]$CloudflareAccountId = $env:CLOUDFLARE_ACCOUNT_ID
)

Write-Host "This helper now uses GitHub CLI instead of embedding secrets in source files." -ForegroundColor Cyan
Write-Host "If you need REST API-based secret management, use a dedicated automation outside the repository." -ForegroundColor Yellow
Write-Host ""
Write-Host "Preferred options:" -ForegroundColor Cyan
Write-Host "1. Set env vars and run .\\setup-secrets.ps1" -ForegroundColor Yellow
Write-Host "2. Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID manually in GitHub Actions secrets" -ForegroundColor Yellow
Write-Host ""
Write-Host "Repo: $Repo" -ForegroundColor Green
Write-Host "Token provided: $([bool]$CloudflareApiToken)" -ForegroundColor Green
Write-Host "Account ID provided: $([bool]$CloudflareAccountId)" -ForegroundColor Green
