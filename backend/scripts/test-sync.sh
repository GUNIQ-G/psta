#!/bin/bash

# LDAP Sync API Test Script

API_URL="http://localhost:3001/api/ldap-sync"

# Check if token is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <JWT_TOKEN>"
  echo "Please provide a JWT token from an ADMIN user"
  exit 1
fi

TOKEN=$1

echo "===================================================="
echo "LDAP Sync API Test"
echo "===================================================="
echo ""

# Test 1: Get sync stats
echo "1. Getting sync statistics..."
curl -s -X GET "$API_URL/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo ""

# Test 2: Get last sync result
echo "2. Getting last sync result..."
curl -s -X GET "$API_URL/last-result" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo ""

# Test 3: Trigger dry-run sync
echo "3. Triggering dry-run sync (no actual changes)..."
curl -s -X POST "$API_URL/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}' | jq '.'

echo ""
echo "===================================================="
echo "Test completed!"
echo "===================================================="
