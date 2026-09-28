const nodemailer = require('nodemailer');

function createMailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_SERVICE } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (SMTP_USER.includes('your-sending-account') || SMTP_PASS.includes('your-16-character')) return null;

  if (SMTP_SERVICE === 'gmail' || (!SMTP_HOST && SMTP_USER.includes('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Sends an official Notice of Mediation Hearing to the resident / complainant.
 */
async function sendMediationNoticeEmail({
  to,
  residentName,
  respondentName,
  caseId,
  date,
  time,
  venue,
  mediator,
  hearingStage,
  notes,
}) {
  if (!to) {
    return { success: false, reason: 'Recipient email address is missing' };
  }

  const transport = createMailTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured. Notification email could not be sent.');
    return { success: false, reason: 'Email service is not configured on this server' };
  }

  const stageLabel = hearingStage || 'Mediation Hearing';
  const displayCase = caseId ? `Case #${caseId}` : 'Barangay Dispute Matter';
  const displayDate = date || 'Date to be confirmed';
  const displayTime = time || 'Time to be announced';
  const displayVenue = venue || 'Barangay Poblacion Mediation Hall / Session Room';
  const displayMediator = mediator || 'Punong Barangay / Designated Lupon Member';

  const subject = `Official Notice: ${stageLabel} for ${displayCase} - Barangay Poblacion`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
          <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #93c5fd; font-weight: 700;">Republic of the Philippines · Province of Cavite</p>
          <h1 style="margin: 6px 0 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">BARANGAY POBLACION</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #cbd5e1;">Office of the Lupong Tagapamayapa · Katarungang Pambarangay</p>
          <div style="margin-top: 14px; display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 5px 14px; border-radius: 20px;">
            Official Notice of Hearing
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 28px 24px;">
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
            Dear <strong>${residentName || 'Resident'}</strong>,
          </p>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #334155;">
            Please be advised that an official <strong>${stageLabel}</strong> has been scheduled regarding <strong>${displayCase}</strong> in accordance with the Katarungang Pambarangay conciliation process.
          </p>

          <!-- Hearing Details Card -->
          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #2563eb; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
            <h3 style="margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e3a8a; font-weight: 700;">
              ⚖️ Hearing & Session Details
            </h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 600;">📅 Scheduled Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${displayDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">⏰ Scheduled Time:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${displayTime}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📍 Venue / Room:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${displayVenue}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">👤 Presiding Officer:</td>
                <td style="padding: 6px 0; color: #0f172a;">${displayMediator}</td>
              </tr>
              ${respondentName ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">👥 Other Party / Respondent:</td>
                <td style="padding: 6px 0; color: #0f172a;">${respondentName}</td>
              </tr>` : ''}
              ${caseId ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📑 Reference Case No.:</td>
                <td style="padding: 6px 0; color: #2563eb; font-weight: 700; font-family: monospace;">${caseId}</td>
              </tr>` : ''}
            </table>
          </div>

          ${notes ? `
          <!-- Notes Card -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px;">
            <strong style="color: #92400e; font-size: 13px; display: block; margin-bottom: 4px;">📌 Important Instructions & Notes:</strong>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">${notes}</p>
          </div>` : ''}

          <!-- Requirements Checklist -->
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 22px;">
            <h4 style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #334155;">What to Bring on the Scheduled Date:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
              <li>At least one (1) valid government-issued identification card (e.g. Barangay ID, Driver's License, PhilID).</li>
              <li>Any relevant documents, photos, or evidence pertinent to this matter.</li>
              <li>Your personal attendance is required; representative appearance is strictly governed by KP law rules.</li>
            </ul>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 20px;">
            You can also log in to your <strong>Barangay Poblacion Resident Portal</strong> to monitor the progress of your case, view hearing updates, and receive live notifications.
          </p>

          <p style="margin: 0; font-size: 13px; color: #334155;">
            Issued by the Authority of the Lupong Tagapamayapa,<br/>
            <strong>Barangay Poblacion Administration</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          This is an official automated administrative notification from the Barangay Poblacion System.<br/>
          If you have questions or require postponement for valid emergency reasons, please contact the Barangay Hall Secretary in advance.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log(`[mailer] Mediation notice email sent to ${to}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[mailer] Failed to send mediation notice email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends an official Notice of Next Hearing / Follow-up Mediation Session to the resident / complainant.
 */
async function sendNextHearingNoticeEmail({
  to,
  residentName,
  respondentName,
  caseId,
  nextMeetingDate,
  nextMeetingTime,
  nextMeetingVenue,
  mediator,
  hearingStage,
  notes,
}) {
  if (!to) {
    return { success: false, reason: 'Recipient email address is missing' };
  }

  const transport = createMailTransport();
  if (!transport) {
    console.warn('[mailer] SMTP not configured. Next session notification email could not be sent.');
    return { success: false, reason: 'Email service is not configured on this server' };
  }

  const displayCase = caseId ? `Case #${caseId}` : 'Mediation Proceeding';
  const displayDate = nextMeetingDate || 'Date to be confirmed';
  const displayTime = nextMeetingTime || '10:00 AM';
  const displayVenue = nextMeetingVenue || 'Barangay Poblacion Mediation Hall';
  const displayMediator = mediator || 'Punong Barangay / Lupon Member';
  const displayStage = hearingStage ? `Follow-up Session (${hearingStage})` : 'Next Follow-up Mediation Session';

  const subject = `Official Notice: Next Mediation Session on ${displayDate} at ${displayTime} - ${displayCase}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header with Distinct Purple/Indigo Accent for Next Session -->
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); color: #ffffff; padding: 28px 24px; text-align: center;">
          <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #c7d2fe; font-weight: 700;">Republic of the Philippines · Province of Cavite</p>
          <h1 style="margin: 6px 0 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">BARANGAY POBLACION</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #e0e7ff;">Office of the Lupong Tagapamayapa · Katarungang Pambarangay</p>
          <div style="margin-top: 14px; display: inline-block; background-color: #7c3aed; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 5px 16px; border-radius: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            🗓️ Notice of Next Mediation Session
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 28px 24px;">
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
            Dear <strong>${residentName || 'Resident'}</strong>,
          </p>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #334155;">
            This is an official administrative notice informing you that your <strong>Next Hearing / Follow-up Mediation Session</strong> has been formally scheduled regarding <strong>${displayCase}</strong> before the Lupong Tagapamayapa.
          </p>

          <!-- Follow-up Session Details Card -->
          <div style="background-color: #faf5ff; border: 1px solid #d8b4fe; border-left: 4px solid #7c3aed; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
            <h3 style="margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #581c87; font-weight: 700;">
              🗓️ Next Session Schedule & Venue Details
            </h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; width: 150px; font-weight: 600;">📅 Next Session Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 800; font-size: 15px;">${displayDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 600;">⏰ Scheduled Time:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 800;">${displayTime}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 600;">📍 Session Venue:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${displayVenue}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 600;">⚖️ Proceeding Stage:</td>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 700;">${displayStage}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 600;">👤 Presiding Officer:</td>
                <td style="padding: 6px 0; color: #0f172a;">${displayMediator}</td>
              </tr>
              ${respondentName ? `
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 600;">👥 Other Party:</td>
                <td style="padding: 6px 0; color: #0f172a;">${respondentName}</td>
              </tr>` : ''}
              ${caseId ? `
              <tr>
                <td style="padding: 6px 0; color: #6b21a8; font-weight: 600;">📑 Reference Case No.:</td>
                <td style="padding: 6px 0; color: #4338ca; font-weight: 700; font-family: monospace;">${caseId}</td>
              </tr>` : ''}
            </table>
          </div>

          ${notes ? `
          <!-- Notes / Reminders Card -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px;">
            <strong style="color: #92400e; font-size: 13px; display: block; margin-bottom: 4px;">📌 Proceeding Reminders & Action Items:</strong>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">${notes}</p>
          </div>` : ''}

          <!-- Requirements Checklist -->
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; margin-bottom: 22px;">
            <h4 style="margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #334155;">Important Instructions for the Next Hearing:</h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
              <li>Please arrive at the venue at least <strong>15 minutes</strong> prior to the designated start time.</li>
              <li>Bring a valid government-issued photo ID (Barangay ID, Driver's License, PhilSys ID, etc.).</li>
              <li>Bring proof of compliance with any action items or party undertakings agreed upon during previous sessions.</li>
              <li>Appearance must be in person; legal counsel or attorney representation is not permitted during Katarungang Pambarangay mediation hearings.</li>
            </ul>
          </div>

          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
            <strong style="color: #1e40af; font-size: 13px; display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              📱 Synchronized with your Resident Account:
            </strong>
            <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
              A live notification has been sent to your <strong>Barangay Poblacion Resident Portal</strong>. You can check session proceedings, settlement progress, and real-time updates at any time by logging into your portal account.
            </p>
          </div>

          <p style="margin: 0; font-size: 13px; color: #334155;">
            Issued by the Authority of the Lupong Tagapamayapa,<br/>
            <strong>Office of the Punong Barangay · Barangay Poblacion</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          This is an official automated administrative notification from the Barangay Poblacion System.<br/>
          If you have questions or require emergency postponement for justifiable cause, please submit an official written notice to the Barangay Hall Secretary in advance.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log(`[mailer] Next session notice email sent to ${to}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[mailer] Failed to send next session notice email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  createMailTransport,
  sendMediationNoticeEmail,
  sendNextHearingNoticeEmail,
};
