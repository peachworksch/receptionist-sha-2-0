import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { 
  SearchKbInput, 
  ProposeSlotInput, 
  BookCalendarInput, 
  ConfirmReadbackInput,
  SearchKbResult,
  ProposeSlotResult,
  BookCalendarResult,
  ConfirmReadbackResult
} from './schemas';
import { findSlot, bookEvent } from '../integrations/google';
import { CallSessionManager } from '../integrations/retell';

interface FaqEntry {
  q: string;
  a: string;
}

let faqData: FaqEntry[] = [];

export function loadFAQ(): void {
  try {
    // Look for FAQ file in multiple locations to handle both dev and production
    let faqPath = join(__dirname, '../data/faq.yaml');
    
    // If not found in dist structure, try src structure for development
    try {
      readFileSync(faqPath, 'utf-8');
    } catch {
      faqPath = join(process.cwd(), 'src/data/faq.yaml');
    }
    
    const faqContent = readFileSync(faqPath, 'utf-8');
    faqData = load(faqContent) as FaqEntry[];
    console.log(`Loaded ${faqData.length} FAQ entries from ${faqPath}`);
  } catch (error) {
    console.error('Error loading FAQ data:', error);
    faqData = [];
  }
}

export function searchKb(input: SearchKbInput): SearchKbResult {
  const query = input.query.toLowerCase();
  const keywords = query.split(' ').filter(word => word.length > 2);
  
  const matches = faqData
    .map(faq => {
      const questionLower = faq.q.toLowerCase();
      const answerLower = faq.a.toLowerCase();
      
      // Score based on keyword matches
      let score = 0;
      keywords.forEach(keyword => {
        if (questionLower.includes(keyword)) score += 3;
        if (answerLower.includes(keyword)) score += 1;
      });
      
      return { ...faq, score };
    })
    .filter(faq => faq.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(faq => ({ q: faq.q, a: faq.a }));

  return { answers: matches };
}

export async function proposeSlot(input: ProposeSlotInput): Promise<ProposeSlotResult> {
  const preferredDate = input.date ? new Date(input.date) : undefined;
  
  try {
    const slot = await findSlot({
      ...(preferredDate ? { date: preferredDate } : {}),
      ...(typeof input.durationMins === 'number' ? { durationMins: input.durationMins } : {})
    });
    
    return slot;
  } catch (error) {
    console.error('Error proposing slot:', error);
    throw new Error('Unable to find available appointment slots. Please try calling back later.');
  }
}

export async function bookCalendar(
  input: BookCalendarInput,
  callId: string,
  sessionManager: CallSessionManager
): Promise<BookCalendarResult> {
  // Check for existing booking (idempotency)
  const existingLink = sessionManager.getExistingBooking(
    callId,
    input.startISO,
    input.endISO
  );
  
  if (existingLink) {
    return {
      status: 'booked',
      link: existingLink
    };
  }
  
  try {
    const link = await bookEvent({
      name: input.name,
      phone: input.phone,
      address: input.address,
      issue: input.issue,
      startISO: input.startISO,
      endISO: input.endISO
    });
    
    // Store the booking in session for idempotency
    sessionManager.addBooking(callId, {
      startISO: input.startISO,
      endISO: input.endISO,
      link
    });
    
    return {
      status: 'booked',
      link
    };
  } catch (error) {
    console.error('Error booking calendar:', error);
    throw new Error('Failed to book appointment. Please try again or call us directly.');
  }
}

export function confirmReadback(input: ConfirmReadbackInput): ConfirmReadbackResult {
  // This is a virtual tool for MVP - always returns ok: true
  // In a real implementation, this would trigger verbal confirmation
  console.log('Appointment details confirmed:', input.details);
  return { ok: true };
}

// Tool dispatcher for webhook handling
export async function dispatchTool(
  toolName: string,
  args: any,
  callId: string,
  sessionManager: CallSessionManager
): Promise<any> {
  try {
    switch (toolName) {
      case 'search_kb':
        return searchKb(args);
        
      case 'propose_slot':
        return await proposeSlot(args);
        
      case 'book_calendar':
        return await bookCalendar(args, callId, sessionManager);
        
      case 'confirm_readback':
        return confirmReadback(args);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`Error in tool ${toolName}:`, error);
    throw error;
  }
}