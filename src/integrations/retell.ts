import { createHmac, timingSafeEqual } from 'crypto';
import { requireEnvVars } from '../env';
import { Request } from 'express';

export function verifyRetellSignature(req: Request, rawBody: Buffer): boolean {
  try {
    const header = (req.headers['x-retell-signature'] || '') as string;
    if (!header) {
      console.error('Missing x-retell-signature header');
      return false;
    }

    const { RETELL_SIGNING_SECRET } = requireEnvVars(['RETELL_SIGNING_SECRET']);
    if (!RETELL_SIGNING_SECRET) {
      console.error('RETELL_SIGNING_SECRET not set');
      return false;
    }

    const expectedHex = createHmac('sha256', RETELL_SIGNING_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(header, 'hex');
    const expBuf = Buffer.from(expectedHex, 'hex');

    if (sigBuf.length !== expBuf.length) {
      console.error(`Signature length mismatch: got=${sigBuf.length} expected=${expBuf.length}`);
      return false;
    }

    return timingSafeEqual(sigBuf, expBuf);
  } catch (err) {
    console.error('Error verifying Retell signature:', err);
    return false;
  }
}

export interface RetellWebhookEvent {
  event: 'call.started' | 'call.ended' | 'transcript.delta' | 'tool.call';
  call: {
    call_id: string;
    agent_id?: string;
    from_number?: string;
    to_number?: string;
    start_timestamp?: number;
    end_timestamp?: number;
  };
  transcript?: {
    delta?: string;
    role?: 'user' | 'agent';
    timestamp?: number;
  };
  tool_call?: {
    tool_call_id: string;
    tool_name: string;
    arguments: Record<string, any>;
  };
}

export interface CallSession {
  transcript: string;
  fields: {
    name?: string;
    phone?: string;
    address?: string;
    issue?: string;
  };
  bookings: Array<{
    startISO: string;
    endISO: string;
    link?: string;
  }>;
  createdAt: Date;
}

export class CallSessionManager {
  private sessions: Map<string, CallSession> = new Map();

  initSession(callId: string): void {
    this.sessions.set(callId, {
      transcript: '',
      fields: {},
      bookings: [],
      createdAt: new Date(),
    });
  }

  getSession(callId: string): CallSession | undefined {
    return this.sessions.get(callId);
  }

  updateTranscript(callId: string, delta: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      session.transcript += delta;
    }
  }

  addBooking(callId: string, booking: { startISO: string; endISO: string; link?: string }): void {
    const session = this.sessions.get(callId);
    if (session) {
      // Check for duplicate booking (idempotency)
      const existingBooking = session.bookings.find(
        b => b.startISO === booking.startISO && b.endISO === booking.endISO
      );
      
      if (!existingBooking) {
        session.bookings.push(booking);
      }
    }
  }

  getExistingBooking(callId: string, startISO: string, endISO: string): string | null {
    const session = this.sessions.get(callId);
    if (session) {
      const existingBooking = session.bookings.find(
        b => b.startISO === startISO && b.endISO === endISO
      );
      return existingBooking?.link || null;
    }
    return null;
  }

  cleanup(callId: string): void {
    const session = this.sessions.get(callId);
    if (session) {
      console.log(`Call ${callId} summary:`, {
        duration: Date.now() - session.createdAt.getTime(),
        bookings: session.bookings.length,
        transcriptLength: session.transcript.length,
      });
      this.sessions.delete(callId);
    }
  }

  // Clean up old sessions (older than 1 hour)
  cleanupOldSessions(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [callId, session] of this.sessions.entries()) {
      if (session.createdAt.getTime() < oneHourAgo) {
        this.cleanup(callId);
      }
    }
  }
}