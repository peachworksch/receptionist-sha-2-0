import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { requireEnvVars } from '../env';
import { TIMEZONE, SERVICE_HOURS, DEFAULT_APPT_DURATION_MINS } from '../agent/prompt';

let calendarClient: any = null;

export function getCalendarClient() {
  if (calendarClient) {
    return calendarClient;
  }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = requireEnvVars([
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'GOOGLE_REFRESH_TOKEN'
  ]);

  const auth = new OAuth2Client({
    ...(GOOGLE_CLIENT_ID ? { clientId: GOOGLE_CLIENT_ID } : {}),
    ...(GOOGLE_CLIENT_SECRET ? { clientSecret: GOOGLE_CLIENT_SECRET } : {}),
  });

  auth.setCredentials({
    ...(GOOGLE_REFRESH_TOKEN ? { refresh_token: GOOGLE_REFRESH_TOKEN } : {}),
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

function getNextBusinessDay(date: Date = new Date()): Date {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const dayOfWeek = nextDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // If it's Sunday (0), move to Monday (1)
  if (dayOfWeek === 0) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  // If it's a valid business day (Mon-Sat: 1-6), return it
  else if (dayOfWeek >= 1 && dayOfWeek <= 6) {
    return nextDay;
  }
  
  return nextDay;
}

function parseServiceTime(timeStr: string, date: Date): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export async function findSlot(params: {
  date?: Date;
  durationMins?: number;
}): Promise<{ startISO: string; endISO: string }> {
  const calendar = getCalendarClient();
  const duration = params.durationMins || DEFAULT_APPT_DURATION_MINS;
  
  let checkDate = params.date || getNextBusinessDay();
  
  // Try up to 7 days to find a slot
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(checkDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    
    // Skip Sundays (day 0)
    if (currentDate.getDay() === 0) {
      continue;
    }
    
    const startOfDay = parseServiceTime(SERVICE_HOURS.start, currentDate);
    const endOfDay = parseServiceTime(SERVICE_HOURS.end, currentDate);
    
    // Check for conflicts using freebusy
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        items: [{ id: 'primary' }],
      },
    });
    
    const busyTimes = freeBusyResponse.data.calendars?.primary?.busy || [];
    
    // Try to find a slot starting from service start time
    let proposedStart = new Date(startOfDay);
    
    while (proposedStart.getTime() + duration * 60 * 1000 <= endOfDay.getTime()) {
      const proposedEnd = new Date(proposedStart.getTime() + duration * 60 * 1000);
      
      // Check if this slot conflicts with any busy time
      const hasConflict = busyTimes.some((busyPeriod: any) => {
        const busyStart = new Date(busyPeriod.start);
        const busyEnd = new Date(busyPeriod.end);
        
        return (
          (proposedStart >= busyStart && proposedStart < busyEnd) ||
          (proposedEnd > busyStart && proposedEnd <= busyEnd) ||
          (proposedStart <= busyStart && proposedEnd >= busyEnd)
        );
      });
      
      if (!hasConflict) {
        return {
          startISO: proposedStart.toISOString(),
          endISO: proposedEnd.toISOString(),
        };
      }
      
      // Move to next 2-hour slot
      proposedStart.setTime(proposedStart.getTime() + 120 * 60 * 1000);
    }
  }
  
  throw new Error('No available slots found in the next 7 days');
}

export async function bookEvent(params: {
  name: string;
  phone: string;
  address: string;
  issue: string;
  startISO: string;
  endISO: string;
}): Promise<string> {
  const calendar = getCalendarClient();
  
  const event = {
    summary: `HVAC Service - ${params.name}`,
    description: `Customer: ${params.name}
Phone: ${params.phone}
Address: ${params.address}
Issue: ${params.issue}`,
    start: {
      dateTime: params.startISO,
      timeZone: TIMEZONE,
    },
    end: {
      dateTime: params.endISO,
      timeZone: TIMEZONE,
    },
    location: params.address,
  };
  
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });
    
    return response.data.htmlLink || 'Event created successfully';
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw new Error('Failed to create calendar event');
  }
}