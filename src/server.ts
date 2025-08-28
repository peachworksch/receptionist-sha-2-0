import express from 'express';
import { 
  verifyRetellSignature, 
  RetellWebhookEvent, 
  CallSessionManager 
} from './integrations/retell';
import { loadFAQ, dispatchTool } from './agent/tools';

const app = express();
const callSessionManager = new CallSessionManager();

// Load FAQ data on startup
loadFAQ();

// Health check endpoint (can use JSON)
app.get('/healthz', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Retell webhook MUST get raw bytes for HMAC verification
// Place this route BEFORE app.use(express.json())
app.post('/retell/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  const rawBody = req.body as Buffer;
  try {
    // Verify signature first
    const isValidSignature = verifyRetellSignature(req, rawBody);
    
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the JSON payload
    const event: RetellWebhookEvent = JSON.parse(rawBody.toString());
    const { call } = event;
    
    console.log(`Webhook event: ${event.event} for call ${call.call_id}`);

    switch (event.event) {
      case 'call.started':
        callSessionManager.initSession(call.call_id);
        console.log(`Call started: ${call.call_id}`);
        break;

      case 'transcript.delta':
        if (event.transcript?.delta) {
          callSessionManager.updateTranscript(call.call_id, event.transcript.delta);
        }
        break;

      case 'tool.call':
        if (event.tool_call) {
          try {
            const result = await dispatchTool(
              event.tool_call.tool_name,
              event.tool_call.arguments,
              call.call_id,
              callSessionManager
            );

            return res.status(200).json({
              tool_call_id: event.tool_call.tool_call_id,
              tool_result: result
            });
          } catch (error) {
            console.error(`Tool call failed:`, error);
            return res.status(200).json({
              tool_call_id: event.tool_call.tool_call_id,
              tool_result: {
                error: error instanceof Error ? error.message : 'Tool execution failed'
              }
            });
          }
        }
        break;

      case 'call.ended':
        callSessionManager.cleanup(call.call_id);
        console.log(`Call ended: ${call.call_id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    // Return 204 for non-tool events
    return res.status(204).send();

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'internal error' });
  }
});

// After defining /retell/webhook, enable JSON parsing for other routes
app.use(express.json());

// Cleanup old sessions every hour
setInterval(() => {
  callSessionManager.cleanupOldSessions();
}, 60 * 60 * 1000);

// Start server - use Cloud Run's PORT env var or default to 8080
const port = Number(process.env.PORT) || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 AI Receptionist server running on port ${port}`);
  console.log(`📞 Webhook endpoint: /retell/webhook`);
  console.log(`🏥 Health check: /healthz`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});