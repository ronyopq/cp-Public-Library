# Setup GitHub Secrets for Cloudflare Deploy (PowerShell)

$REPO = "ronyopq/cp-Public-Library"
$TOKEN = "yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82"
$ACCOUNT_ID = "0aa3a7240be2b718a369f43f91e200b9"

Write-Host "🔧 Setting up GitHub Secrets..." -ForegroundColor Cyan
Write-Host "Repository: $REPO" -ForegroundColor Yellow
Write-Host ""

# Check if GitHub CLI is installed
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghInstalled) {
    Write-Host "❌ GitHub CLI not found" -ForegroundColor Red
    Write-Host "Install from: https://cli.github.com" -ForegroundColor Yellow
    exit 1
}

# Check authentication
Write-Host "🔐 Checking GitHub authentication..." -ForegroundColor Cyan
$authStatus = & gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Please login to GitHub..." -ForegroundColor Yellow
    & gh auth login
}

# Set secrets
Write-Host "📝 Setting CLOUDFLARE_API_TOKEN..." -ForegroundColor Cyan
$TOKEN | & gh secret set CLOUDFLARE_API_TOKEN -R $REPO

Write-Host "✅ CLOUDFLARE_API_TOKEN set!" -ForegroundColor Green
Write-Host ""

Write-Host "📝 Setting CLOUDFLARE_ACCOUNT_ID..." -ForegroundColor Cyan
$ACCOUNT_ID | & gh secret set CLOUDFLARE_ACCOUNT_ID -R $REPO

Write-Host "✅ CLOUDFLARE_ACCOUNT_ID set!" -ForegroundColor Green
Write-Host ""

Write-Host "✅ All secrets configured!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Website will auto-deploy at: https://cppl-site.pages.dev" -ForegroundColor Cyan
Write-Host "📊 Check deployment: https://github.com/$REPO/actions" -ForegroundColor Yellow
