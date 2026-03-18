# Setup GitHub Secrets using GitHub REST API (PowerShell)

param(
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [string]$Owner = "ronyopq",
    [string]$Repo = "cp-Public-Library"
)

if (-not $GitHubToken) {
    Write-Host "❌ Error: GITHUB_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To use this script, set your GitHub Personal Access Token:" -ForegroundColor Yellow
    Write-Host '  $env:GITHUB_TOKEN = "github_pat_xxxxxxxxxxxx"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Cyan
    exit 1
}

$REPO = "$Owner/$Repo"
Write-Host "🔧 Setting up GitHub Secrets via API..." -ForegroundColor Cyan
Write-Host "Repository: $REPO" -ForegroundColor Yellow
Write-Host ""

# Secrets to set
$secrets = @{
    "CLOUDFLARE_API_TOKEN" = "yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82"
    "CLOUDFLARE_ACCOUNT_ID" = "0aa3a7240be2b718a369f43f91e200b9"
}

# Function to encrypt secret value (GitHub uses libsodium)
function Encrypt-GHSecret {
    param([string]$SecretValue, [string]$PublicKey, [string]$KeyId)
    
    # This is complex - requires libsodium
    # For now, we'll use a simpler approach with the API
    return $SecretValue
}

# Get public key for repo
Write-Host "📝 Getting repository public key..." -ForegroundColor Cyan
$keyUrl = "https://api.github.com/repos/$REPO/actions/secrets/public-key"
$headers = @{
    "Authorization" = "token $GitHubToken"
    "Accept" = "application/vnd.github.v3+json"
}

try {
    $keyResponse = Invoke-RestMethod -Uri $keyUrl -Headers $headers -ErrorAction Stop
    $publicKey = $keyResponse.key
    $keyId = $keyResponse.key_id
    Write-Host "✅ Got public key" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get public key: $_" -ForegroundColor Red
    exit 1
}

# This approach won't work without proper encryption
Write-Host ""
Write-Host "⚠️  API encryption requires GNU sodium library" -ForegroundColor Yellow
Write-Host ""
Write-Host "Easier alternative:" -ForegroundColor Cyan
Write-Host "1. Go to: https://github.com/$REPO/settings/secrets/actions" -ForegroundColor Yellow
Write-Host "2. Click 'New repository secret'" -ForegroundColor Yellow
Write-Host "3. Add two secrets:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Name: CLOUDFLARE_API_TOKEN" -ForegroundColor Cyan
Write-Host "   Value: yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Name: CLOUDFLARE_ACCOUNT_ID" -ForegroundColor Cyan
Write-Host "   Value: 0aa3a7240be2b718a369f43f91e200b9" -ForegroundColor Cyan
Write-Host ""
Write-Host "Takes 2 minutes! Then website auto-deploys." -ForegroundColor Green
