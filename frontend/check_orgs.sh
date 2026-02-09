#!/bin/bash
PGPASSWORD='CoachPlatform2026!SecureDB' psql \
  "host=coach-db-1770519048.postgres.database.azure.com port=5432 dbname=coach_platform user=dbadmin sslmode=require" \
  -c "SELECT id, name, category FROM organizations LIMIT 5;"
