#!/bin/bash

# Mock webhook testing script for AI Receptionist
set -e

BASE_URL="http://localhost:8080"
WEBHOOK_URL="${BASE_URL}/retell/webhook"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🧪 Testing AI Receptionist Webhooks${NC}"
echo "Base URL: $BASE_URL"
echo ""

# Function to test webhook
test_webhook() {
    local file=$1
    local description=$2
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "File: $file"
    
    # Create HMAC signature for the payload
    payload=$(cat "$file")
    signature=$(echo -n "$payload" | openssl dgst -sha256 -hmac "${RETELL_SIGNING_SECRET:-test-secret}" | cut -d' ' -f2)
    
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-retell-signature: sha256=${signature}" \
        -d "$payload" \
        "$WEBHOOK_URL")
    
    http_status=$(echo "$response" | tail -n1 | sed 's/HTTP_STATUS://')
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_status" -eq 200 ] || [ "$http_status" -eq 204 ]; then
        echo -e "✅ Success (HTTP $http_status)"
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "Response: $body"
        fi
    else
        echo -e "${RED}❌ Failed (HTTP $http_status)${NC}"
        echo "Response: $body"
    fi
    echo ""
}

# Test health check first
echo -e "${YELLOW}Testing health check...${NC}"
health_response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/healthz")
health_status=$(echo "$health_response" | tail -n1 | sed 's/HTTP_STATUS://')
if [ "$health_status" -eq 200 ]; then
    echo -e "✅ Health check passed"
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi
echo ""

# Run webhook tests in sequence
test_webhook "call-started.json" "Call Started Event"
test_webhook "tool-search-kb.json" "Search Knowledge Base Tool"
test_webhook "tool-propose-slot.json" "Propose Slot Tool"
test_webhook "tool-book-calendar.json" "Book Calendar Tool"
test_webhook "call-ended.json" "Call Ended Event"

echo -e "${GREEN}🎉 All tests completed!${NC}"