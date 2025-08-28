import { z } from 'zod';

export const SearchKbSchema = z.object({
  query: z.string().describe('Search query for the knowledge base')
});

export const ProposeSlotSchema = z.object({
  date: z.string().optional().describe('Preferred date in YYYY-MM-DD format'),
  durationMins: z.number().optional().describe('Duration in minutes, defaults to 120')
});

export const BookCalendarSchema = z.object({
  name: z.string().describe('Customer full name'),
  phone: z.string().describe('Customer phone number'),
  address: z.string().describe('Customer address'),
  issue: z.string().describe('Description of the HVAC issue'),
  startISO: z.string().describe('Start time in ISO format'),
  endISO: z.string().describe('End time in ISO format')
});

export const ConfirmReadbackSchema = z.object({
  details: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
    issue: z.string(),
    startISO: z.string(),
    endISO: z.string()
  }).describe('Confirmed appointment details')
});

export type SearchKbInput = z.infer<typeof SearchKbSchema>;
export type ProposeSlotInput = z.infer<typeof ProposeSlotSchema>;
export type BookCalendarInput = z.infer<typeof BookCalendarSchema>;
export type ConfirmReadbackInput = z.infer<typeof ConfirmReadbackSchema>;

export interface SearchKbResult {
  answers: Array<{
    q: string;
    a: string;
  }>;
}

export interface ProposeSlotResult {
  startISO: string;
  endISO: string;
}

export interface BookCalendarResult {
  status: 'booked';
  link: string;
}

export interface ConfirmReadbackResult {
  ok: boolean;
}