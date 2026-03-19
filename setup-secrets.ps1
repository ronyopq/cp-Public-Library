param(
    [string]$Repo = "owner/repo",
    [string]$CloudflareApiToken = $env:CLOUDFLARE_API_TOKEN,
    [string]$CloudflareAccountId = $env:CLOUDFLARE_ACCOUNT_ID
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "GitHub CLI (gh) is required. Install it from https://cli.github.com"
    exit 1
}

if (-not $CloudflareApiToken) {
    $CloudflareApiToken = Read-Host "Enter CLOUDFLARE_API_TOKEN"
}

if (-not $CloudflareAccountId) {
    $CloudflareAccountId = Read-Host "Enter CLOUDFLARE_ACCOUNT_ID"
}

if (-not $CloudflareApiToken -or -not $CloudflareAccountId) {
    Write-Error "Both CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required."
    exit 1
}

$CloudflareApiToken | gh secret set CLOUDFLARE_API_TOKEN -R $Repo
$CloudflareAccountId | gh secret set CLOUDFLARE_ACCOUNT_ID -R $Repo

Write-Host "GitHub Actions secrets updated for $Repo" -ForegroundColor Green
