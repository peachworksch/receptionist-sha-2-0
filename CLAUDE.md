# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server with hot reload
npm run dev

# TypeScript compilation and validation
npm run build
npm run typecheck  # Build without emitting files

# Production server (requires build first)
npm start

# Container build and deployment
gcloud builds submit --tag us-west1-docker.pkg.dev/receptionist-sha-2-0/ai-receptionist/web:$(date +%Y%m%d-%H%M%S)
gcloud run deploy ai-receptionist --image [IMAGE_URL] --region us-west1

# Local webhook testing
cd sample-events && ./test.sh

# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=ai-receptionist" --limit=20
```

## Architecture Overview

This is an AI Receptionist MVP that handles voice calls through a webhook-driven architecture:

**Request Flow**: Retell Voice → Webhook → Express Server → Tool Dispatch → Google Calendar/FAQ
- Retell sends webhook events for call lifecycle and tool invocations
- Express server validates HMAC signatures and routes events
- Tool dispatcher handles 4 core functions: FAQ search, slot finding, booking, confirmation
- Session manager maintains call state with automatic cleanup

**Core Components**:
- `src/server.ts`: Express server with `/retell/webhook` endpoint and signature verification
- `src/integrations/retell.ts`: Webhook signature verification and session state management  
- `src/agent/tools.ts`: Tool implementations and dispatcher for all AI function calls
- `src/integrations/google.ts`: Google Calendar API integration with conflict resolution
- `src/data/faq.yaml`: Knowledge base loaded at startup for FAQ searches

**Tool Architecture**:
The system implements 4 tools called by Retell's LLM via webhooks:
1. `search_kb`: Keyword-based FAQ search with scoring algorithm
2. `propose_slot`: Calendar slot finding with freebusy conflict detection
3. `book_calendar`: Calendar event creation with idempotency checking
4. `confirm_readback`: Virtual confirmation tool (MVP implementation)

## Key Implementation Details

**Session Management**: Each call gets a session with transcript tracking, field collection, and booking history. Sessions auto-cleanup after 1 hour to prevent memory leaks.

**Webhook Security**: All Retell webhooks verified using HMAC-SHA256 signature with raw body capture middleware on `/retell/webhook` route only.

**Calendar Integration**: Uses OAuth2 refresh token flow (single business account). Slot finding checks freebusy, handles conflicts by shifting 2-hour intervals, and respects business hours (Mon-Sat 9AM-5PM PST).

**Business Configuration**: Centralized in `src/agent/prompt.ts` - company name, timezone, service hours, and appointment duration. FAQ entries managed in `src/data/faq.yaml`.

**Environment Setup**: Zod validation in `src/env.ts` ensures all required API keys present. Development uses `.env`, production uses Cloud Run environment variables. **CRITICAL**: `PORT` is excluded from env validation as it's reserved by Cloud Run - server uses `process.env.PORT` directly.

**Deployment**: Dockerized with multi-stage build, non-root user, and health checks. Key considerations:
- Data files (`src/data/faq.yaml`) must be copied to `dist/data/` before removing src directory
- Cloud Run requires container to bind to `process.env.PORT` (assigned dynamically)
- Environment variables must be passed via `--set-env-vars` (not `--env-vars-file` which expects YAML/JSON)

## Critical Development Notes

**Port Binding**: Server must use `process.env.PORT` directly (not through env validation) for Cloud Run compatibility. Local development defaults to 8080.

**Data File Access**: FAQ loading at startup looks for files in two locations:
1. `__dirname/../data/faq.yaml` (production: `/app/dist/data/faq.yaml`)  
2. `process.cwd()/src/data/faq.yaml` (development fallback)

**TypeScript Configuration**: `exactOptionalPropertyTypes: true` requires conditional spreads for optional parameters:
```typescript
const slot = await findSlot({
  ...(preferredDate ? { date: preferredDate } : {}),
  ...(typeof durationMins === 'number' ? { durationMins } : {})
});
```

**Webhook Middleware**: Raw body capture must be route-specific for signature verification:
```typescript
app.use('/retell/webhook', express.raw({ type: 'application/json' }));
app.use(express.json()); // For other routes
```

## Testing & Development

Local webhook testing requires ngrok to expose localhost:8080. The `sample-events/` directory contains mock webhook payloads. 

FAQ search uses keyword matching with weighted scoring (questions: 3x, answers: 1x). Session state includes transcript accumulation and booking idempotency to prevent duplicate calendar events.

## Common Deployment Issues

1. **Container fails to start**: Usually port binding - ensure server uses `process.env.PORT`
2. **FAQ loading fails**: Check data file copying in Dockerfile 
3. **Environment validation fails**: Verify all required vars passed via `--set-env-vars`
4. **Signature verification fails**: Ensure raw body middleware only on webhook route