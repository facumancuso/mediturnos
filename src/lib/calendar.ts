/**
 * Calendar link utilities.
 * Generates Google Calendar URLs and iCal (.ics) content
 * compatible with iOS Calendar, Apple Calendar, and Outlook.
 */

export type CalendarEvent = {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  durationMinutes: number;
  uid?: string;
  sequence?: number;
  lastModified?: Date;
};

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const end = new Date(event.startDate.getTime() + event.durationMinutes * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(end)}`,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildICalContent(event: CalendarEvent): string {
  const end = new Date(event.startDate.getTime() + event.durationMinutes * 60 * 1000);
  const uid = event.uid || `${Date.now()}-${Math.random().toString(36).slice(2)}@mediturnos`;
  const now = formatICalDate(new Date());
  const lastModified = formatICalDate(event.lastModified || new Date());
  const sequence = Number.isFinite(event.sequence) ? Math.max(0, Math.trunc(event.sequence as number)) : 0;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MediTurnos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `LAST-MODIFIED:${lastModified}`,
    `SEQUENCE:${sequence}`,
    `DTSTART:${formatICalDate(event.startDate)}`,
    `DTEND:${formatICalDate(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location || ''}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
