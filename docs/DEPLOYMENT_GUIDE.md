# 🚀 COACH PLATFORM - COMPLETE DEPLOYMENT GUIDE

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Azure Cloud Deployment](#azure-cloud-deployment)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [API Keys & Integrations](#api-keys--integrations)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Required Software
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)
- **Azure CLI** - [Install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Docker** (Optional but recommended) - [Download](https://www.docker.com/)

### Azure Account Setup
1. Create an Azure account (Free tier available)
2. Install Azure CLI
3. Login to Azure:
   ```bash
   az login
   ```

---

## 💻 Local Development Setup

### Step 1: Clone and Setup Project

```bash
# Navigate to your project directory
cd /path/to/coach-platform

# Create Python virtual environment
cd backend
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### Step 2: Setup PostgreSQL Database Locally

```bash
# Start PostgreSQL service
# On Mac (if using Homebrew):
brew services start postgresql@14

# On Ubuntu/Debian:
sudo systemctl start postgresql

# On Windows: Use Services app or pg_ctl

# Create database and user
psql postgres

# In PostgreSQL shell:
CREATE DATABASE coach_platform;
CREATE USER coach_platform_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE coach_platform TO coach_platform_user;
\q
```

### Step 3: Run Database Migrations

```bash
# Navigate to database directory
cd ../database

# Run schema creation
psql -U coach_platform_user -d coach_platform -f schema.sql

# Run seed data (for development/testing)
psql -U coach_platform_user -d coach_platform -f seed_data.sql

# Verify tables created
psql -U coach_platform_user -d coach_platform -c "\dt"
```

### Step 4: Configure Environment Variables

```bash
# Go back to backend directory
cd ../backend

# Copy example env file
cp .env.example .env

# Edit .env file with your local settings
# Minimum required for local development:
nano .env  # or use your preferred editor
```

**Minimum .env for local development:**
```env
APP_ENV=development
DEBUG=True
SECRET_KEY=your-super-secret-key-min-32-characters-long

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coach_platform
DB_USER=coach_platform_user
DB_PASSWORD=your_secure_password

# Leave others empty for now (will configure later)
```

### Step 5: Run Backend Server

```bash
# Make sure you're in backend directory with venv activated
python main.py

# Or use uvicorn directly:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ Backend should be running at: `http://localhost:8000`
📚 API Docs available at: `http://localhost:8000/api/docs`

### Step 6: Setup Frontend

```bash
# Open new terminal, navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Coach Platform
EOF

# Start development server
npm run dev
```

✅ Frontend should be running at: `http://localhost:5173` or `http://localhost:3000`

---

## ☁️ Azure Cloud Deployment

### Step 1: Azure Resource Setup

```bash
# Login to Azure
az login

# Set subscription (if you have multiple)
az account set --subscription "your-subscription-id"

# Create Resource Group (India Central)
az group create \
  --name coach-platform-rg \
  --location centralindia

# Create App Service Plan (B1 tier for production, Free F1 for testing)
az appservice plan create \
  --name coach-platform-plan \
  --resource-group coach-platform-rg \
  --location centralindia \
  --sku B1 \
  --is-linux
```

### Step 2: Create PostgreSQL Database (Azure)

```bash
# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group coach-platform-rg \
  --name coach-platform-db \
  --location centralindia \
  --admin-user dbadmin \
  --admin-password 'YourSecurePassword123!' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 14 \
  --storage-size 32

# Configure firewall to allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group coach-platform-rg \
  --name coach-platform-db \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group coach-platform-rg \
  --server-name coach-platform-db \
  --database-name coach_platform
```

### Step 3: Create Azure Storage Account

```bash
# Create Storage Account for media files
az storage account create \
  --name coachplatformstorage \
  --resource-group coach-platform-rg \
  --location centralindia \
  --sku Standard_LRS \
  --kind StorageV2

# Get storage account key
az storage account keys list \
  --resource-group coach-platform-rg \
  --account-name coachplatformstorage

# Create blob container
az storage container create \
  --name media-assets \
  --account-name coachplatformstorage \
  --public-access off
```

### Step 4: Deploy Backend to Azure App Service

```bash
# Create Web App for backend
az webapp create \
  --resource-group coach-platform-rg \
  --plan coach-platform-plan \
  --name coach-platform-api \
  --runtime "PYTHON:3.11"

# Configure environment variables (do this for ALL variables from .env)
az webapp config appsettings set \
  --resource-group coach-platform-rg \
  --name coach-platform-api \
  --settings \
    APP_ENV=production \
    DEBUG=False \
    SECRET_KEY="your-production-secret-key" \
    DB_HOST="coach-platform-db.postgres.database.azure.com" \
    DB_NAME="coach_platform" \
    DB_USER="dbadmin" \
    DB_PASSWORD="YourSecurePassword123!" \
    AZURE_STORAGE_ACCOUNT_NAME="coachplatformstorage" \
    AZURE_STORAGE_ACCOUNT_KEY="your-storage-key"

# Deploy code
cd backend
zip -r deploy.zip .
az webapp deploy \
  --resource-group coach-platform-rg \
  --name coach-platform-api \
  --src-path deploy.zip \
  --type zip

# Configure startup command
az webapp config set \
  --resource-group coach-platform-rg \
  --name coach-platform-api \
  --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app"
```

### Step 5: Deploy Frontend to Azure Static Web Apps

```bash
# Create Static Web App
az staticwebapp create \
  --name coach-platform-frontend \
  --resource-group coach-platform-rg \
  --location centralindia

# Build frontend
cd ../frontend
npm run build

# Deploy (you can use Azure Static Web Apps CLI or GitHub Actions)
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist \
  --app-name coach-platform-frontend \
  --resource-group coach-platform-rg \
  --subscription-id your-subscription-id
```

---

## 🗄️ Database Setup (Detailed)

### Run Migrations on Azure PostgreSQL

```bash
# Get database connection string
az postgres flexible-server show-connection-string \
  --server-name coach-platform-db

# Connect to Azure PostgreSQL
psql "host=coach-platform-db.postgres.database.azure.com port=5432 dbname=coach_platform user=dbadmin password=YourSecurePassword123! sslmode=require"

# Run schema
\i /path/to/schema.sql

# Run seed data (development only)
\i /path/to/seed_data.sql
```

### Automated Migration with Alembic (Recommended for Production)

```bash
cd backend

# Initialize Alembic (if not already done)
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "initial schema"

# Run migration
alembic upgrade head
```

---

## 🔑 API Keys & Integrations Setup

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Coach Platform"
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://your-domain.com/auth/google/callback` (production)
6. Copy Client ID and Client Secret to `.env`

### 2. Twilio (WhatsApp) Setup

1. Create account at [Twilio](https://www.twilio.com/)
2. Get a Twilio phone number with WhatsApp capability
3. Configure WhatsApp sandbox (for testing)
4. Copy Account SID and Auth Token to `.env`
5. Set webhook URL: `https://your-api-domain.com/api/v1/webhooks/whatsapp`

### 3. Meta WhatsApp Business API (Production)

1. Create [Meta Business Account](https://business.facebook.com/)
2. Create WhatsApp Business Account
3. Get Business Account ID and Phone Number ID
4. Generate permanent access token
5. Set webhook URL and verify token
6. Copy credentials to `.env`

### 4. OpenAI API Setup

1. Create account at [OpenAI](https://platform.openai.com/)
2. Generate API key
3. Set up billing
4. Copy API key to `.env`

### 5. Razorpay (Payment) Setup

1. Create account at [Razorpay](https://razorpay.com/)
2. Complete KYC verification
3. Get Test API keys (for development)
4. Get Live API keys (for production)
5. Set up webhook: `https://your-api-domain.com/api/v1/webhooks/razorpay`
6. Copy Key ID and Key Secret to `.env`

---

## 🧪 Testing

### Backend API Testing

```bash
cd backend

# Run tests
pytest

# Run specific test
pytest tests/test_auth.py

# With coverage
pytest --cov=app tests/
```

### Frontend Testing

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Manual API Testing

Use the Swagger docs at `http://localhost:8000/api/docs`

Or use curl:
```bash
# Health check
curl http://localhost:8000/health

# Create user (example)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'
```

---

## 🚢 Production Deployment Checklist

### Before Deployment

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] All API keys activated (production keys)
- [ ] Rate limiting configured
- [ ] Monitoring setup (Application Insights)
- [ ] Backup strategy in place
- [ ] Security review completed

### Security Checklist

- [ ] Change all default passwords
- [ ] Use strong SECRET_KEY (32+ characters, random)
- [ ] Enable HTTPS only
- [ ] Configure CORS properly (specific origins, not *)
- [ ] Enable database SSL connections
- [ ] Implement rate limiting
- [ ] Set up WAF (Web Application Firewall)
- [ ] Regular security updates
- [ ] Encrypt sensitive data at rest
- [ ] Implement proper access controls

### Post-Deployment

```bash
# Verify backend is running
curl https://your-api-domain.com/health

# Check logs
az webapp log tail \
  --resource-group coach-platform-rg \
  --name coach-platform-api

# Monitor performance
az monitor metrics list \
  --resource /subscriptions/{subscription-id}/resourceGroups/coach-platform-rg/providers/Microsoft.Web/sites/coach-platform-api
```

---

## 📊 Monitoring & Maintenance

### Setup Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app coach-platform-insights \
  --location centralindia \
  --resource-group coach-platform-rg

# Get instrumentation key
az monitor app-insights component show \
  --app coach-platform-insights \
  --resource-group coach-platform-rg \
  --query instrumentationKey
```

### Monitoring Dashboard

- **Azure Portal**: Monitor > Application Insights
- **Metrics to track**:
  - API response times
  - Error rates
  - Database connections
  - Memory usage
  - Request counts

### Backup Strategy

```bash
# Automated PostgreSQL backups (Azure handles this)
# But you can also create manual backups:

# Backup database
az postgres flexible-server backup create \
  --resource-group coach-platform-rg \
  --server-name coach-platform-db \
  --backup-name manual-backup-$(date +%Y%m%d)

# Backup storage account (for media files)
az storage blob snapshot \
  --account-name coachplatformstorage \
  --container-name media-assets
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Check if database is accessible
psql -h coach-platform-db.postgres.database.azure.com -U dbadmin -d coach_platform

# Verify firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group coach-platform-rg \
  --name coach-platform-db
```

**2. API Not Responding**
```bash
# Check app service status
az webapp show \
  --resource-group coach-platform-rg \
  --name coach-platform-api \
  --query state

# Restart if needed
az webapp restart \
  --resource-group coach-platform-rg \
  --name coach-platform-api

# View logs
az webapp log tail \
  --resource-group coach-platform-rg \
  --name coach-platform-api
```

**3. WhatsApp Messages Not Sending**
- Verify Twilio credentials
- Check webhook configuration
- Review message queue logs
- Ensure phone number format is correct (+91...)

**4. Payment Integration Issues**
- Verify Razorpay keys (test vs live)
- Check webhook URL is publicly accessible
- Review webhook signature verification
- Check Razorpay dashboard for failed transactions

---

## 📝 Quick Commands Reference

```bash
# Start local development
cd backend && source venv/bin/activate && python main.py
cd frontend && npm run dev

# Deploy to Azure
cd backend && az webapp deploy --resource-group coach-platform-rg --name coach-platform-api --src-path deploy.zip --type zip

# View logs
az webapp log tail --resource-group coach-platform-rg --name coach-platform-api

# Restart services
az webapp restart --resource-group coach-platform-rg --name coach-platform-api

# Database migration
cd backend && alembic upgrade head

# Run tests
cd backend && pytest
cd frontend && npm test
```

---

## 📞 Support & Resources

- **Azure Documentation**: https://docs.microsoft.com/azure
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **React Documentation**: https://react.dev/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/

---

## 🎉 You're All Set!

Your Coach-Client Engagement Platform is now deployed and ready to use!

**Access Points:**
- Frontend: `https://your-frontend-domain.azurestaticapps.net`
- Backend API: `https://coach-platform-api.azurewebsites.net`
- API Docs: `https://coach-platform-api.azurewebsites.net/api/docs`

**Next Steps:**
1. Configure custom domain
2. Set up SSL certificates
3. Configure monitoring alerts
4. Train your team
5. Start onboarding clients!

---

*Last Updated: February 2026*
