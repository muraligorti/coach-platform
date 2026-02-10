# GitHub Setup Instructions

## 1. Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `coach-platform`
3. Description: `FitLife Coaching Platform - Full Stack App`
4. Visibility: **Private** (recommended) or Public
5. Do NOT initialize with README (we already have code)
6. Click "Create repository"

## 2. Connect Local Repo to GitHub

After creating the repo, GitHub will show you commands. Run:
```bash
cd ~/coach-platform

# Add GitHub as remote
git remote add origin https://github.com/YOUR_USERNAME/coach-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 3. Set Up Azure Deployment from GitHub

### Option A: Azure Portal (Easy)

1. Go to Azure Portal: https://portal.azure.com
2. Navigate to your App Service: `coach-api-1770519048`
3. Click "Deployment Center" in left menu
4. Source: Select "GitHub"
5. Authorize Azure to access your GitHub
6. Select:
   - Organization: Your GitHub username
   - Repository: coach-platform
   - Branch: main
   - Build Provider: App Service Build Service
7. Click "Save"

Now every git push will auto-deploy to Azure!

### Option B: GitHub Actions (Advanced)

Create `.github/workflows/deploy.yml` for custom deployment pipeline.

## 4. Workflow After Setup
```bash
# Make changes
cd ~/coach-platform
# Edit files...

# Commit changes
git add .
git commit -m "Add feature X"

# Push to GitHub (auto-deploys to Azure)
git push origin main

# To test before deploying, use branches:
git checkout -b feature-new-feature
# Make changes...
git commit -m "Testing new feature"
git push origin feature-new-feature
# Review on GitHub, then merge when ready
```

## Benefits

✅ Every change is tracked
✅ Can rollback to any previous version
✅ Auto-deployment on push
✅ Code backup
✅ Collaboration ready

