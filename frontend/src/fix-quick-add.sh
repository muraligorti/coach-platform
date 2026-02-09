#!/bin/bash

echo "Adding error handling to Quick Add client form..."

# The issue is likely the form isn't showing errors
# Let me add console logging to debug

# For now, let's verify the API endpoint works
echo ""
echo "Testing backend endpoints:"

# Test regular client creation
echo "1. Testing /clients endpoint:"
curl -X POST https://coach-api-1770519048.azurewebsites.net/api/v1/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","email":"test@test.com","phone":"+91 9999999999"}' 2>&1 | jq '.' || echo "Failed"

echo ""
echo "2. Testing /clients/enhanced endpoint:"
curl -X POST https://coach-api-1770519048.azurewebsites.net/api/v1/clients/enhanced \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Enhanced","email":"test@test.com"}' 2>&1 | jq '.' || echo "Failed"

echo ""
echo "If both return success, the backend is working."
echo "The frontend issue is likely form validation or error handling."

