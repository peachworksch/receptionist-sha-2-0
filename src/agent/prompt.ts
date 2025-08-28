export const COMPANY_NAME = 'Woodland HVAC Services';
export const TIMEZONE = 'America/Los_Angeles';
export const SERVICE_HOURS = {
  start: '09:00',
  end: '17:00',
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};
export const DEFAULT_APPT_DURATION_MINS = 120;

export const SYSTEM_PROMPT = `You are a warm, professional receptionist for ${COMPANY_NAME}. Your role is to:

1. Collect customer information: name, phone, address, and HVAC issue description
2. Answer questions using your knowledge base (search_kb tool)
3. Propose available appointment times (propose_slot tool)
4. Confirm details with the customer (confirm_readback tool)
5. Book confirmed appointments (book_calendar tool)

CONVERSATION FLOW:
- Always collect ALL required info: name, phone, address, issue
- Use search_kb for any questions about services, hours, or policies
- Only propose times after collecting customer information
- Read back all details and get verbal confirmation before booking
- Keep responses concise and friendly

IMPORTANT RULES:
- Do NOT invent information - only use search_kb results
- Always collect complete address (not just city)
- Confirm appointment details before calling book_calendar
- If customer goes off-topic, politely redirect to booking
- Service hours: ${SERVICE_HOURS.days.join(', ')} ${SERVICE_HOURS.start}-${SERVICE_HOURS.end} PST

Stay focused on scheduling appointments efficiently while being helpful and professional.`;

export const GEMINI_TOOLS = [
  {
    name: 'search_kb',
    description: 'Search the knowledge base for answers to customer questions',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for the knowledge base'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'propose_slot',
    description: 'Find and propose an available appointment time slot',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Preferred date in YYYY-MM-DD format (optional)'
        },
        durationMins: {
          type: 'number',
          description: 'Duration in minutes, defaults to 120'
        }
      },
      required: []
    }
  },
  {
    name: 'book_calendar',
    description: 'Book the confirmed appointment in Google Calendar',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name' },
        phone: { type: 'string', description: 'Customer phone number' },
        address: { type: 'string', description: 'Customer address' },
        issue: { type: 'string', description: 'Description of the HVAC issue' },
        startISO: { type: 'string', description: 'Start time in ISO format' },
        endISO: { type: 'string', description: 'End time in ISO format' }
      },
      required: ['name', 'phone', 'address', 'issue', 'startISO', 'endISO']
    }
  },
  {
    name: 'confirm_readback',
    description: 'Confirm appointment details with customer after reading them back',
    parameters: {
      type: 'object',
      properties: {
        details: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            address: { type: 'string' },
            issue: { type: 'string' },
            startISO: { type: 'string' },
            endISO: { type: 'string' }
          },
          required: ['name', 'phone', 'address', 'issue', 'startISO', 'endISO']
        }
      },
      required: ['details']
    }
  }
];