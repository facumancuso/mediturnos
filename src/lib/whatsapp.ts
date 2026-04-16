/**
 * WhatsApp messaging abstraction layer.
 *
 * Currently uses wa.me links (manual send by professional).
 * To switch to an API provider in the future, implement the
 * corresponding block inside `sendWhatsAppMessage` and set the
 * appropriate env vars — no other file needs to change.
 *
 * Supported providers (future):
 *   - Twilio:  WHATSAPP_PROVIDER=twilio + TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *   - Meta:    WHATSAPP_PROVIDER=meta   + META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID
 */

export type WhatsAppPayload = {
  to: string;      // patient phone number (any format)
  message: string;
};

export type WhatsAppResult =
  | { method: 'wame'; url: string }
  | { method: 'api'; sent: boolean; error?: string };

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function sendWhatsAppMessage(payload: WhatsAppPayload): Promise<WhatsAppResult> {
  const provider = process.env.WHATSAPP_PROVIDER || 'wame';
  const phone = normalizePhone(payload.to);

  // ── Twilio ────────────────────────────────────────────────────
  if (provider === 'twilio') {
    // TODO: npm install twilio
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    //   to: `whatsapp:+${phone}`,
    //   body: payload.message,
    // });
    // return { method: 'api', sent: true };
    return { method: 'api', sent: false, error: 'Twilio not configured yet.' };
  }

  // ── Meta WhatsApp Business API ────────────────────────────────
  if (provider === 'meta') {
    // TODO: use Meta Cloud API
    // const res = await fetch(
    //   `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       messaging_product: 'whatsapp',
    //       to: phone,
    //       type: 'text',
    //       text: { body: payload.message },
    //     }),
    //   }
    // );
    // const ok = res.ok;
    // return { method: 'api', sent: ok };
    return { method: 'api', sent: false, error: 'Meta API not configured yet.' };
  }

  // ── wa.me (default — manual) ──────────────────────────────────
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(payload.message)}`;
  return { method: 'wame', url };
}

// ── Message templates ─────────────────────────────────────────────

export function buildConfirmationMessage(params: {
  patientName: string;
  professionalName: string;
  date: string;
  time: string;
  calendarLinks?: { google: string; ical: string };
}): string {
  const calendarSection = params.calendarLinks
    ? `\n\n📆 *Agendá el turno en tu calendario:*\n` +
      `• Google Calendar: ${params.calendarLinks.google}\n` +
      `• iPhone / Outlook (.ics): ${params.calendarLinks.ical}`
    : '';

  return (
    `Hola ${params.patientName} 👋\n\n` +
    `Tu turno con *${params.professionalName}* ha sido *confirmado* ✅\n\n` +
    `📅 *Fecha:* ${params.date}\n` +
    `🕐 *Hora:* ${params.time} hs` +
    calendarSection +
    `\n\n¡Te esperamos!`
  );
}

export function buildReminderMessage(params: {
  patientName: string;
  professionalName: string;
  date: string;
  time: string;
  statusUrl: string; // full URL to /estado-turno
}): string {
  return (
    `Hola ${params.patientName} 👋\n\n` +
    `Te recordamos que mañana tenés turno con *${params.professionalName}* 📋\n\n` +
    `📅 *Fecha:* ${params.date}\n` +
    `🕐 *Hora:* ${params.time} hs\n\n` +
    `Por favor confirmá tu asistencia desde el siguiente enlace:\n` +
    `${params.statusUrl}\n\n` +
    `¡Hasta mañana!`
  );
}

export function buildRatingRequestMessage(params: {
  patientName: string;
  professionalName: string;
  ratingUrl: string;
}): string {
  return (
    `Hola ${params.patientName} 👋\n\n` +
    `Esperamos que tu consulta con *${params.professionalName}* haya sido de tu agrado 🙏\n\n` +
    `Tu opinión nos ayuda a seguir mejorando. ¿Podés tomarte un momento para calificar la atención?\n\n` +
    `⭐ *Dejá tu reseña aquí:*\n` +
    `${params.ratingUrl}\n\n` +
    `Este enlace es personal, válido por 24 horas y se desactiva apenas completes la calificación.\n\n` +
    `¡Muchas gracias!`
  );
}
