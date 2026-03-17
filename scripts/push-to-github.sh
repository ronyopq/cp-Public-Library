#!/bin/bash
# Quick script to push Public Library Management System to GitHub

set -e

echo "🚀 Public Library Management System - GitHub Push"
echo "================================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
  echo "📍 Git not initialized. Initializing..."
  git init
  git config user.name "$(git config --global user.name || echo 'Developer')"
  git config user.email "$(git config --global user.email || echo 'dev@library.bd')"
fi

# Check if remote exists
if ! git remote | grep -q origin; then
  echo "📍 No remote found. Adding origin..."
  git remote add origin https://github.com/ronyopq/cp-Public-Library.git
else
  echo "✅ Remote 'origin' already configured"
fi

# Show status
echo ""
echo "📊 Current status:"
git status --short | head -20
echo ""

# Count changes
CHANGES=$(git status --short | wc -l)
echo "📈 Total files changed: $CHANGES"

# Ask for confirmation
echo ""
read -p "Continue with push? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Push cancelled"
  exit 1
fi

# Stage all files
echo ""
echo "📝 Staging files..."
git add .

# Create commit if not already on main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Not on main branch (currently: $CURRENT_BRANCH)"
  read -p "Create commit and switch to main? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Commit message: " -r MESSAGE
    git commit -m "$MESSAGE" || echo "⚠️  Nothing to commit on current branch"
    git checkout -b main 2>/dev/null || git checkout main
  fi
fi

# Ensure main branch
if [ "$CURRENT_BRANCH" != "main" ]; then
  git checkout main
fi

# Get current commit
COMMIT=$(git log -1 --pretty=format:"%h - %s")
echo "✅ Latest commit: $COMMIT"

# Push
echo ""
echo "🚢 Pushing to GitHub..."
git push -u origin main 2>&1 || {
  echo ""
  echo "⚠️  Push failed. Try:"
  echo "   1. Use HTTPS token instead of password"
  echo "   2. Set up SSH key: https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
  echo "   3. Use GitHub CLI: gh repo create --public --source=."
  exit 1
}

echo ""
echo "✨ Success! Repository pushed to GitHub"
echo ""
echo "📍 View repository: https://github.com/ronyopq/cp-Public-Library"
echo "📍 Clone elsewhere: git clone https://github.com/ronyopq/cp-Public-Library.git"
echo ""
echo "Next steps:"
echo "1. Configure GitHub Actions secrets (see GITHUB_SETUP.md)"
echo "2. Enable branch protection for main"
echo "3. Set up GitHub Pages for documentation"
echo "4. Invite team members"
echo ""
