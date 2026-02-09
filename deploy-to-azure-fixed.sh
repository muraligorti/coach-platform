#!/bin/bash

set -e

echo "🚀 Deploying Coach Platform to Azure (Fixed)"
echo "=============================================="
echo ""

# Configuration
RESOURCE_GROUP="coach-platform-rg"
LOCATION="centralindia"
TIMESTAMP=$(date +%s)
DB_SERVER_NAME="coach-db-${TIMESTAMP}"
BACKEND_APP_NAME="coach-api-${TIMESTAMP}"

# Step 1: Register providers
echo "Step 1: Registering Azure providers..."
echo "This is a one-time setup and may take 2-5 minutes..."

az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.Storage

echo "Waiting for providers to register..."
while [ "$(az provider show --namespace Microsoft.DBforPostgreSQL --query registrationState -o tsv)" != "Registered" ]; do
    echo "  PostgreSQL provider still registering..."
    sleep 10
done
echo "✅ Providers registered!"

# Step 2: Create Resource Group
echo ""
echo "Step 2: Creating Resource Group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

echo ""
echo "✅ Resource group created!"
echo ""
echo "=============================================="
echo "⚠️  IMPORTANT: Cost Information"
echo "=============================================="
echo ""
echo "The next steps will create PAID resources:"
echo "  • PostgreSQL Database: ~₹1,500/month"
echo "  • App Service (B1): ~₹750/month"
echo "  • Storage: ~₹100/month"
echo "  TOTAL: ~₹2,500/month"
echo ""
echo "This is the CHEAPEST production setup."
echo "You can delete everything later with:"
echo "  az group delete --name $RESOURCE_GROUP"
echo ""
read -p "Continue with deployment? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 3: Create PostgreSQL
echo ""
echo "Step 3: Creating PostgreSQL Database..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --location $LOCATION \
  --admin-user dbadmin \
  --admin-password 'CoachPlatform2026!SecureDB' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 14 \
  --storage-size 32 \
  --public-access 0.0.0.0

# Allow Azure services
az postgres flexible-server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_SERVER_NAME \
  --rule-name AllowAzure \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $DB_SERVER_NAME \
  --database-name coach_platform

# Step 4: Load schema
echo ""
echo "Step 4: Loading database schema..."
DB_HOST="${DB_SERVER_NAME}.postgres.database.azure.com"

PGPASSWORD='CoachPlatform2026!SecureDB' psql \
  "host=$DB_HOST port=5432 dbname=coach_platform user=dbadmin sslmode=require" \
  -f database/schema.sql

PGPASSWORD='CoachPlatform2026!SecureDB' psql \
  "host=$DB_HOST port=5432 dbname=coach_platform user=dbadmin sslmode=require" \
  -f database/seed_data.sql

# Step 5: Create App Service
echo ""
echo "Step 5: Creating App Service..."
az appservice plan create \
  --name coach-plan \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku B1

az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan coach-plan \
  --name $BACKEND_APP_NAME \
  --runtime "PYTHON:3.11"

# Configure app
SECRET_KEY=$(openssl rand -base64 32)

az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --settings \
    APP_ENV=production \
    DEBUG=False \
    SECRET_KEY="$SECRET_KEY" \
    DB_HOST="$DB_HOST" \
    DB_PORT=5432 \
    DB_NAME=coach_platform \
    DB_USER=dbadmin \
    DB_PASSWORD='CoachPlatform2026!SecureDB' \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true

# Deploy code
echo ""
echo "Step 6: Deploying backend code..."
cd backend

# Create requirements.txt if missing gunicorn
if ! grep -q "gunicorn" requirements.txt; then
    echo "gunicorn==21.2.0" >> requirements.txt
fi

zip -r ../deploy.zip . -x "venv/*" "__pycache__/*" "*.pyc"
cd ..

az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --src deploy.zip

# Set startup command
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP_NAME \
  --startup-file "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind=0.0.0.0:8000 --timeout 600"

echo ""
echo "=============================================="
echo "✅ Deployment Complete!"
echo "=============================================="
echo ""
echo "🌐 Backend API: https://${BACKEND_APP_NAME}.azurewebsites.net"
echo "📚 API Docs: https://${BACKEND_APP_NAME}.azurewebsites.net/api/docs"
echo ""
echo "🗄️  Database:"
echo "   Host: $DB_HOST"
echo "   Database: coach_platform"
echo "   User: dbadmin"
echo "   Password: CoachPlatform2026!SecureDB"
echo ""
echo "🧪 Test it:"
echo "   curl https://${BACKEND_APP_NAME}.azurewebsites.net/health"
echo ""
echo "💰 Monthly Cost: ~₹2,500"
echo ""
echo "🗑️  To delete everything:"
echo "   az group delete --name $RESOURCE_GROUP --yes"
echo ""
