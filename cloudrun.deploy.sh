#!/bin/bash

# AI Receptionist - Cloud Run Deployment Script
set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-your-project-id}"
SERVICE_NAME="ai-receptionist"
REGION="${CLOUD_RUN_REGION:-us-west1}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying AI Receptionist to Cloud Run${NC}"
echo "Project: ${PROJECT_ID}"
echo "Service: ${SERVICE_NAME}"
echo "Region: ${REGION}"
echo ""

# Check if required environment variables are set
if [ -z "$RETELL_SIGNING_SECRET" ]; then
    echo -e "${RED}❌ RETELL_SIGNING_SECRET environment variable not set${NC}"
    exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}❌ GEMINI_API_KEY environment variable not set${NC}"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo -e "${RED}❌ GOOGLE_CLIENT_ID environment variable not set${NC}"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo -e "${RED}❌ GOOGLE_CLIENT_SECRET environment variable not set${NC}"
    exit 1
fi

if [ -z "$GOOGLE_REFRESH_TOKEN" ]; then
    echo -e "${RED}❌ GOOGLE_REFRESH_TOKEN environment variable not set${NC}"
    exit 1
fi

# Build and push Docker image
echo -e "${YELLOW}📦 Building Docker image...${NC}"
docker build -t ${IMAGE_NAME} .

echo -e "${YELLOW}⬆️  Pushing image to Container Registry...${NC}"
docker push ${IMAGE_NAME}

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --platform=managed \
  --region=${REGION} \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1 \
  --concurrency=100 \
  --timeout=300s \
  --port=8080 \
  --set-env-vars="PORT=8080" \
  --set-env-vars="RETELL_SIGNING_SECRET=${RETELL_SIGNING_SECRET}" \
  --set-env-vars="GEMINI_API_KEY=${GEMINI_API_KEY}" \
  --set-env-vars="GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
  --set-env-vars="GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}" \
  --set-env-vars="GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN}" \
  --project=${PROJECT_ID}

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --platform=managed --region=${REGION} --format="value(status.url)" --project=${PROJECT_ID})

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""
echo -e "${GREEN}🌐 Service URL: ${SERVICE_URL}${NC}"
echo -e "${GREEN}🔗 Webhook URL: ${SERVICE_URL}/retell/webhook${NC}"
echo -e "${GREEN}❤️  Health Check: ${SERVICE_URL}/healthz${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Test health check: curl ${SERVICE_URL}/healthz"
echo "2. Update Retell webhook URL to: ${SERVICE_URL}/retell/webhook"
echo "3. Test with a live call through Retell"