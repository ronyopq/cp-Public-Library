#!/bin/bash
# Setup GitHub Secrets for Cloudflare Deploy

set -e

REPO="ronyopq/cp-Public-Library"
TOKEN="yePcNYOgACyicgSpA9xr-U3kN3nzakltub3ipT82"
ACCOUNT_ID="0aa3a7240be2b718a369f43f91e200b9"

echo "🔧 Setting up GitHub Secrets..."
echo "Repository: $REPO"

# Install GitHub CLI if needed
if ! command -v gh &> /dev/null; then
    echo "Installing GitHub CLI..."
    # Installation instructions for different OS
    echo "Please install GitHub CLI from: https://cli.github.com"
    exit 1
fi

# Authenticate
echo "🔐 Authenticating with GitHub..."
gh auth login

# Set secrets
echo "📝 Setting CLOUDFLARE_API_TOKEN..."
echo "$TOKEN" | gh secret set CLOUDFLARE_API_TOKEN -R $REPO

echo "📝 Setting CLOUDFLARE_ACCOUNT_ID..."
echo "$ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID -R $REPO

echo "✅ Secrets configured!"
echo ""
echo "🚀 Website will auto-deploy at: https://cppl-site.pages.dev"
