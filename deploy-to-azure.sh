#!/bin/bash

set -e

echo "🚀 Deploying Coach Platform to Azure (India Region)"
echo "=================================================="
echo ""

# Configuration
RESOURCE_GROUP="coach-platform-rg"
LOCATION="centralindia"
DB_SERVER_NAME="coach-platform-db-$(date +%s)"
DB_ADMIN_USER="dbadmin"
DB_ADMIN_PASSWORD="CoachPlatform2026!SecureDB"
DB_NAME="coach_platform"
APP_SERVICE_PLAN="coach-platform-plan"
BACKEND_APP_NAME="coach-platform-api-$(date +%s)"
FRONTEND_APP_NAME="coach-platform-web-$(date +%s)"
STORAGE_ACCOUNT_NAME="coachstorage$(date +%s | cut -c 6-15)"

echo "📋 Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Location: $LOCATION"
echo "  Database Server: $DB_SERVER_NAME"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Step 1: Create Resource Group
echo ""
echo "Step 1/7: Creating Resource Group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output table

# Step 2: Create PostgreSQL Flexible Server
echo ""
echo "Step 2/7: Creating PostgreSQL Database (this takes 3-5 minutes)..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password "$DB_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 14 \
  --storage-size 32 \
  --public-access 0.0.0.0 \
  --output table

echo "Waiting for database to be ready..."
sleep 30

# Create database
echo "Creating database '$DB_NAME'..."
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name $DB_NAME \
  --output table

# Configure firewall
echo "Configuring firewall rules..."
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAllAzureIPs \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Step 3: Load Database Schema
echo ""
echo "Step 3/7: Loading database schema..."
DB_HOST="${DB_SERVER_NAME}.postgres.database.azure.com"

# Install PostgreSQL client if not present
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL client..."
    sudo apt-get update && sudo apt-get install -y postgresql-client
fi

PGPASSWORD="$DB_ADMIN_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_ADMIN_USER" \
  -d "$DB_NAME" \
  -f database/schema.sql

echo "Loading seed data..."
PGPASSWORD="$DB_ADMIN_PASSWORD" psql \
  -h "$DB_HOST" \
  -U "$DB_ADMIN_USER" \
  -d "$DB_NAME" \
  -f database/seed_data.sql

# Step 4: Create Storage Account
echo ""
echo "Step 4/7: Creating Storage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --output table

STORAGE_KEY=$(az storage account keys list \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT_NAME \
  --query '[0].value' -o tsv)

az storage container create \
  --name media-assets \
  --account-name $STORAGE_ACCOUNT_NAME \
  --account-key "$STORAGE_KEY" \
  --public-access off

# Step 5: Create App Service Plan
echo ""
echo "Step 5/7: Creating App Service Plan..."
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku B1 \
  --output table

# Step 6: Create and Deploy Backend
echo ""
echo "Step 6/7: Creating Backend Web App..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $BACKEND_APP_NAME \
  --runtime "PYTHON:3.11" \
  --output table

# Generate a secure secret key
SECRET_KEY=$(openssl rand -base64 32)

# Configure environment variables
echo "Configuring backend environment variables..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --settings \
    APP_ENV=production \
    DEBUG=False \
    SECRET_KEY="$SECRET_KEY" \
    DB_HOST="$DB_HOST" \
    DB_PORT=5432 \
    DB_NAME="$DB_NAME" \
    DB_USER="$DB_ADMIN_USER" \
    DB_PASSWORD="$DB_ADMIN_PASSWORD" \
    AZURE_STORAGE_ACCOUNT_NAME="$STORAGE_ACCOUNT_NAME" \
    AZURE_STORAGE_ACCOUNT_KEY="$STORAGE_KEY" \
    AZURE_STORAGE_CONTAINER_NAME="media-assets" \
    CORS_ORIGINS="https://${FRONTEND_APP_NAME}.azurewebsites.net" \
    FEATURE_AI_INTENT_ENABLED=True \
    FEATURE_WHATSAPP_ENABLED=True \
    FEATURE_COMMUNITY_ENABLED=True \
    FEATURE_REFERRALS_ENABLED=True \
    FEATURE_PAYMENTS_ENABLED=True \
  --output table

# Deploy backend code
echo "Deploying backend code..."
cd backend
zip -r ../deploy.zip . -x "venv/*" -x "__pycache__/*" -x "*.pyc"
cd ..

az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --src deploy.zip

# Configure startup command
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000"

# Step 7: Deploy Frontend
echo ""
echo "Step 7/7: Creating Frontend Static Web App..."
az staticwebapp create \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --output table

echo ""
echo "=============================================="
echo "✅ Deployment Complete!"
echo "=============================================="
echo ""
echo "🌐 Your Application URLs:"
echo "  Backend API: https://${BACKEND_APP_NAME}.azurewebsites.net"
echo "  API Docs:    https://${BACKEND_APP_NAME}.azurewebsites.net/api/docs"
echo "  Frontend:    https://${FRONTEND_APP_NAME}.azurestaticapps.net"
echo ""
echo "📋 Database Connection:"
echo "  Host: $DB_HOST"
echo "  Database: $DB_NAME"
echo "  User: $DB_ADMIN_USER"
echo "  Password: $DB_ADMIN_PASSWORD"
echo ""
echo "💾 Storage Account:"
echo "  Name: $STORAGE_ACCOUNT_NAME"
echo ""
echo "📝 Save these details! You'll need them for configuration."
echo ""
echo "🔍 Next Steps:"
echo "  1. Test backend: curl https://${BACKEND_APP_NAME}.azurewebsites.net/health"
echo "  2. Configure frontend to point to backend API"
echo "  3. Add API keys (Google OAuth, Twilio, Razorpay, OpenAI) via Azure Portal"
echo ""
echo "💰 Estimated Monthly Cost: ~₹7,500 INR"
echo ""
