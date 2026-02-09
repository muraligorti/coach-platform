#!/bin/bash

# Coach Platform - Quick Start Script
# This script sets up the development environment

set -e  # Exit on error

echo "🚀 Coach Platform - Quick Start Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        print_success "Docker and Docker Compose are installed"
        return 0
    else
        print_error "Docker or Docker Compose not found"
        echo "Please install Docker Desktop from: https://www.docker.com/get-started"
        return 1
    fi
}

# Check if Python is installed
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
        print_success "Python $PYTHON_VERSION is installed"
        return 0
    else
        print_error "Python 3 not found"
        echo "Please install Python 3.11+ from: https://www.python.org/downloads/"
        return 1
    fi
}

# Check if Node.js is installed
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION is installed"
        return 0
    else
        print_error "Node.js not found"
        echo "Please install Node.js 18+ from: https://nodejs.org/"
        return 1
    fi
}

# Check if PostgreSQL is installed (for manual setup)
check_postgres() {
    if command -v psql &> /dev/null; then
        PG_VERSION=$(psql --version | cut -d' ' -f3)
        print_success "PostgreSQL $PG_VERSION is installed"
        return 0
    else
        print_info "PostgreSQL not found (optional for Docker setup)"
        return 1
    fi
}

# Main setup function
main() {
    echo "Step 1: Checking prerequisites..."
    echo "--------------------------------"
    
    HAS_DOCKER=false
    HAS_PYTHON=false
    HAS_NODE=false
    
    if check_docker; then
        HAS_DOCKER=true
    fi
    
    if check_python; then
        HAS_PYTHON=true
    fi
    
    if check_node; then
        HAS_NODE=true
    fi
    
    check_postgres
    
    echo ""
    echo "Step 2: Choose setup method"
    echo "---------------------------"
    echo "1) Docker (Recommended - Easiest)"
    echo "2) Manual Setup (More control)"
    echo ""
    read -p "Choose option (1 or 2): " SETUP_METHOD
    
    if [ "$SETUP_METHOD" = "1" ]; then
        if [ "$HAS_DOCKER" = true ]; then
            setup_with_docker
        else
            print_error "Docker is required for this option"
            exit 1
        fi
    elif [ "$SETUP_METHOD" = "2" ]; then
        if [ "$HAS_PYTHON" = true ] && [ "$HAS_NODE" = true ]; then
            setup_manual
        else
            print_error "Python and Node.js are required for manual setup"
            exit 1
        fi
    else
        print_error "Invalid option"
        exit 1
    fi
}

# Docker setup
setup_with_docker() {
    echo ""
    print_info "Setting up with Docker..."
    echo ""
    
    # Create necessary directories
    mkdir -p backend/logs
    mkdir -p frontend/node_modules
    
    # Start services
    print_info "Starting Docker services (this may take a few minutes)..."
    docker-compose up -d
    
    echo ""
    print_info "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        echo ""
        print_success "All services are running!"
        echo ""
        echo "====================================="
        echo "🎉 Setup Complete!"
        echo "====================================="
        echo ""
        echo "Access your application at:"
        echo "  Frontend:       http://localhost:3000"
        echo "  Backend API:    http://localhost:8000"
        echo "  API Docs:       http://localhost:8000/api/docs"
        echo "  Database Admin: http://localhost:8080"
        echo ""
        echo "Default test account:"
        echo "  Phone: +919876543210 (use OTP login)"
        echo ""
        echo "To view logs:"
        echo "  docker-compose logs -f"
        echo ""
        echo "To stop services:"
        echo "  docker-compose down"
        echo ""
    else
        print_error "Services failed to start. Check logs with: docker-compose logs"
        exit 1
    fi
}

# Manual setup
setup_manual() {
    echo ""
    print_info "Setting up manually..."
    echo ""
    
    # Check for PostgreSQL
    read -p "Have you created the PostgreSQL database 'coach_platform'? (y/n): " DB_CREATED
    if [ "$DB_CREATED" != "y" ]; then
        echo ""
        echo "Please create the database first:"
        echo "  psql postgres"
        echo "  CREATE DATABASE coach_platform;"
        echo "  CREATE USER coach_platform_user WITH PASSWORD 'your_password';"
        echo "  GRANT ALL PRIVILEGES ON DATABASE coach_platform TO coach_platform_user;"
        echo "  \\q"
        echo ""
        read -p "Press Enter after creating the database..."
    fi
    
    # Run database migrations
    print_info "Running database migrations..."
    read -p "Enter database user (default: coach_platform_user): " DB_USER
    DB_USER=${DB_USER:-coach_platform_user}
    
    if [ -f "database/schema.sql" ]; then
        psql -U "$DB_USER" -d coach_platform -f database/schema.sql
        print_success "Schema created"
        
        read -p "Load seed data? (y/n): " LOAD_SEED
        if [ "$LOAD_SEED" = "y" ]; then
            psql -U "$DB_USER" -d coach_platform -f database/seed_data.sql
            print_success "Seed data loaded"
        fi
    fi
    
    # Setup backend
    print_info "Setting up backend..."
    cd backend
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
        print_success "Virtual environment created"
    fi
    
    source venv/bin/activate || . venv/Scripts/activate
    pip install -r requirements.txt
    print_success "Backend dependencies installed"
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Created .env file - Please edit it with your credentials"
    fi
    
    cd ..
    
    # Setup frontend
    print_info "Setting up frontend..."
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Frontend dependencies installed"
    fi
    
    cd ..
    
    echo ""
    print_success "Manual setup complete!"
    echo ""
    echo "====================================="
    echo "🎉 Setup Complete!"
    echo "====================================="
    echo ""
    echo "To start the application:"
    echo ""
    echo "Terminal 1 (Backend):"
    echo "  cd backend"
    echo "  source venv/bin/activate"
    echo "  python main.py"
    echo ""
    echo "Terminal 2 (Frontend):"
    echo "  cd frontend"
    echo "  npm run dev"
    echo ""
    echo "Then access:"
    echo "  Frontend: http://localhost:3000 or http://localhost:5173"
    echo "  Backend:  http://localhost:8000"
    echo "  API Docs: http://localhost:8000/api/docs"
    echo ""
}

# Run main function
main
