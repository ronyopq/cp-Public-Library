@echo off
REM Quick script to push Public Library Management System to GitHub (Windows)

echo 🚀 Public Library Management System - GitHub Push
echo ================================================
echo.

REM Check if git is initialized
if not exist .git (
  echo 📍 Git not initialized. Initializing...
  call git init
  call git config user.name "Developer"
  call git config user.email "dev@library.bd"
)

REM Check if remote exists
for /f "tokens=*" %%i in ('git remote') do (
  if "%%i"=="origin" (
    echo ✅ Remote 'origin' already configured
    goto :skip_remote
  )
)

echo 📍 No remote found. Adding origin...
call git remote add origin https://github.com/ronyopq/cp-Public-Library.git

:skip_remote
echo.
echo 📊 Current status:
call git status --short
echo.

REM Show changes count
setlocal enabledelayedexpansion
for /f %%i in ('git status --short ^| find /c /v ""') do set CHANGES=%%i
echo 📈 Total files changed: !CHANGES!

REM Ask for confirmation
echo.
set /p CONFIRM="Continue with push? (y/n) "
if /i not "%CONFIRM%"=="y" (
  echo ❌ Push cancelled
  exit /b 1
)

REM Stage all files
echo.
echo 📝 Staging files...
call git add .

REM Get current commit
for /f "tokens=*" %%i in ('git log -1 --pretty=format:"%%h - %%s"') do set COMMIT=%%i
echo ✅ Latest commit: %COMMIT%

REM Push
echo.
echo 🚢 Pushing to GitHub...
call git push -u origin main

if errorlevel 1 (
  echo.
  echo ⚠️  Push failed. Try:
  echo    1. Use HTTPS token instead of password
  echo    2. Set up SSH key: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
  echo    3. Use GitHub CLI: gh repo create --public --source=.
  exit /b 1
)

echo.
echo ✨ Success! Repository pushed to GitHub
echo.
echo 📍 View repository: https://github.com/ronyopq/cp-Public-Library
echo 📍 Clone elsewhere: git clone https://github.com/ronyopq/cp-Public-Library.git
echo.
echo Next steps:
echo 1. Configure GitHub Actions secrets (see GITHUB_SETUP.md)
echo 2. Enable branch protection for main
echo 3. Set up GitHub Pages for documentation
echo 4. Invite team members
echo.
pause
