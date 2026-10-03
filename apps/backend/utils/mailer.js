const { Resend } = require('resend');

function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error('Recipient email address is missing.');
  if (!isResendConfigured()) throw new Error('Resend email configuration is missing.');

  const resend = new Resend(process.env.RESEND_API_KEY.trim());
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM.trim(),
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html,
  });
  if (error) throw new Error(error.message || 'Resend could not send the email.');
  return { success: true, messageId: data?.id };
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
    const info = await sendEmail({
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
    const info = await sendEmail({
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

/**
 * Sends an official Account Approval / Verification email to a resident.
 */
async function sendResidentApprovalEmail({
  to,
  residentName,
  residentId,
  loginUrl,
}) {
  if (!to) {
    return { success: false, reason: 'Recipient email address is missing' };
  }

  const targetLoginUrl = loginUrl || (process.env.RESIDENT_FRONTEND_URL ? `${process.env.RESIDENT_FRONTEND_URL.replace(/\/$/, '')}/login` : 'http://localhost:5500/login');
  const displayName = residentName || 'Resident';
  const displayId = residentId || 'N/A';
  const approvalDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const subject = '🎉 Account Approved by Admin - Barangay Poblacion Residents Portal';

  const text = `Hello ${displayName},\n\n`
    + `Good news! Your resident account registration for the Barangay Poblacion Residents Portal has been officially approved and verified by the Barangay Admin.\n\n`
    + `Account Details:\n`
    + `- Name: ${displayName}\n`
    + `- Resident ID: ${displayId}\n`
    + `- Registered Email: ${to}\n`
    + `- Status: Approved & Verified by Admin\n`
    + `- Date Approved: ${approvalDate}\n\n`
    + `You can now sign in to your resident portal account at:\n`
    + `${targetLoginUrl}\n\n`
    + `If you did not register for this account, please contact the Barangay Poblacion Hall immediately.\n\n`
    + `Barangay Poblacion Administration\n`
    + `Office of the Punong Barangay`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.06);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%); color: #ffffff; padding: 32px 24px; text-align: center;">
          <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #a7f3d0; font-weight: 700;">Republic of the Philippines · Province of Cavite</p>
          <h1 style="margin: 6px 0 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">BARANGAY POBLACION</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #d1fae5;">Office of the Punong Barangay · Online Residents Portal</p>
          <div style="margin-top: 16px; display: inline-block; background-color: #10b981; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; padding: 6px 18px; border-radius: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            ✓ Approved by Barangay Admin
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 32px 28px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
            Dear <strong>${displayName}</strong>,
          </p>
          <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.7; color: #334155;">
            Mabuhay! We are pleased to notify you that your registration for the <strong>Barangay Poblacion Residents Portal</strong> has been officially reviewed and <strong style="color: #059669;">approved</strong> by the Barangay Administration.
          </p>
          <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.7; color: #334155;">
            Your identity and household verification have been completed. Your account is now fully active, giving you 24/7 online access to official barangay services.
          </p>

          <!-- Account Details Card -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; border-radius: 10px; padding: 20px; margin-bottom: 26px;">
            <h3 style="margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46; font-weight: 800;">
              📋 Approved Resident Account Details
            </h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #047857; width: 140px; font-weight: 600;">Resident Name:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${displayName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #047857; font-weight: 600;">Resident ID:</td>
                <td style="padding: 6px 0; color: #065f46; font-weight: 700; font-family: monospace;">${displayId}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #047857; font-weight: 600;">Registered Email:</td>
                <td style="padding: 6px 0; color: #0f172a;">${to}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #047857; font-weight: 600;">Account Status:</td>
                <td style="padding: 6px 0; color: #16a34a; font-weight: 800;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #16a34a; margin-right: 6px;"></span>Verified & Active
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #047857; font-weight: 600;">Date Approved:</td>
                <td style="padding: 6px 0; color: #0f172a;">${approvalDate}</td>
              </tr>
            </table>
          </div>

          <!-- Call To Action Button -->
          <div style="text-align: center; margin: 30px 0 28px;">
            <a href="${targetLoginUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 34px; border-radius: 8px; font-weight: 800; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.35);">
              Sign In to Residents Portal →
            </a>
            <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
              Or navigate directly to: <a href="${targetLoginUrl}" style="color: #059669; text-decoration: underline;">${targetLoginUrl}</a>
            </p>
          </div>

          <!-- Security Notice -->
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 12px; color: #64748b; line-height: 1.6;">
            <strong>🔒 Security Reminder:</strong> Barangay staff will never ask for your password. If you did not apply for this account, please report it immediately to the Barangay Poblacion Hall.
          </div>

          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">
            Sincerely,<br/>
            <strong>Office of the Punong Barangay & Sangguniang Barangay</strong><br/>
            Barangay Poblacion Administration
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
          This is an automated administrative notification sent from Barangay Poblacion.<br/>
          Barangay Hall, Poblacion· For inquiries, visit the Barangay Hall during office hours.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await sendEmail({
      to,
      subject,
      text,
      html,
    });
    console.log(`[mailer] Resident approval email sent to ${to}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[mailer] Failed to send resident approval email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends an official notification email to a resident whose account is Pending Verification (no match in registry).
 */
async function sendResidentPendingVerificationEmail({
  to,
  residentName,
  residentId,
  loginUrl,
}) {
  if (!to) {
    return { success: false, reason: 'Recipient email address is missing' };
  }

  const targetLoginUrl = loginUrl || (process.env.RESIDENT_FRONTEND_URL ? `${process.env.RESIDENT_FRONTEND_URL.replace(/\/$/, '')}/login` : 'http://localhost:5500/login');
  const displayName = residentName || 'Resident';
  const displayId = residentId || 'N/A';
  const registrationDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const subject = '⏳ Registration Received - Pending Verification - Barangay Poblacion';

  const text = `Hello ${displayName},\n\n`
    + `Thank you for registering on the Barangay Poblacion Residents Portal.\n\n`
    + `We conducted an automated lookup against the official Barangay Resident Database, but an existing matching record could not yet be found.\n\n`
    + `Account Status: PENDING VERIFICATION (Limited Access)\n`
    + `- Resident Name: ${displayName}\n`
    + `- Resident ID: ${displayId}\n`
    + `- Date Registered: ${registrationDate}\n\n`
    + `LIMITED ACCESS RULE:\n`
    + `You can now sign in to the Residents Portal and submit community complaints, incident reports, and view barangay advisories.\n\n`
    + `Sign in at:\n`
    + `${targetLoginUrl}\n\n`
    + `Our barangay administrators will review your submitted identification documents. Once verified, full certification and clearance services will become available.\n\n`
    + `Barangay Poblacion Administration\n`
    + `Office of the Punong Barangay`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.06);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #ffffff; padding: 32px 24px; text-align: center;">
          <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; font-weight: 700;">Republic of the Philippines · Province of Cavite</p>
          <h1 style="margin: 6px 0 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">BARANGAY POBLACION</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #cbd5e1;">Office of the Punong Barangay · Online Residents Portal</p>
          <div style="margin-top: 16px; display: inline-block; background-color: #f59e0b; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; padding: 6px 18px; border-radius: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            ⏳ Registration Pending Verification
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 32px 28px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6;">
            Dear <strong>${displayName}</strong>,
          </p>
          <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.7; color: #334155;">
            Thank you for registering on the <strong>Barangay Poblacion Residents Portal</strong>. We performed an automated check against the official Barangay Resident Database, but an existing matching record could not yet be confirmed.
          </p>

          <!-- Status Notice Card -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="color: #92400e; font-size: 14px;">📋 Limited-Access Active</strong>
              <span style="font-size: 11px; font-weight: 700; background-color: #fef3c7; color: #b45309; padding: 3px 10px; border-radius: 12px;">PENDING VERIFICATION</span>
            </div>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">
              Under our <strong>limited-access policy</strong>, you can still sign in to file formal complaints, report community or infrastructure concerns, and track ongoing proceedings while awaiting administrator review.
            </p>
          </div>

          <!-- Account Details Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 26px;">
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; color: #64748b; width: 140px; font-weight: 600;">Applicant Name:</td>
                <td style="padding: 5px 0; color: #0f172a; font-weight: 700;">${displayName}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Reference ID:</td>
                <td style="padding: 5px 0; color: #334155; font-family: monospace; font-weight: 700;">${displayId}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Registered Email:</td>
                <td style="padding: 5px 0; color: #0f172a;">${to}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Status:</td>
                <td style="padding: 5px 0; color: #d97706; font-weight: 700;">⏳ Pending Verification</td>
              </tr>
            </table>
          </div>

          <!-- Call To Action Button -->
          <div style="text-align: center; margin: 26px 0 24px;">
            <a href="${targetLoginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; box-shadow: 0 4px 10px rgba(30, 41, 59, 0.25);">
              Sign In with Limited Access →
            </a>
            <p style="margin: 10px 0 0; font-size: 12px; color: #64748b;">
              Login portal: <a href="${targetLoginUrl}" style="color: #2563eb; text-decoration: underline;">${targetLoginUrl}</a>
            </p>
          </div>

          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 12px; color: #64748b; line-height: 1.6;">
            <strong>ℹ️ What happens next?</strong> Barangay administrators will review your submitted valid ID and selfie. Once verified, official clearance and certificate services will be unlocked.
          </div>

          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">
            Sincerely,<br/>
            <strong>Barangay Poblacion Administration</strong><br/>
            Office of the Punong Barangay
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6;">
          This is an automated administrative notification sent from Barangay Poblacion.<br/>
          Barangay Hall, Poblacion, Cavite
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await sendEmail({
      to,
      subject,
      text,
      html,
    });
    console.log(`[mailer] Resident pending verification email sent to ${to}, messageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[mailer] Failed to send resident pending verification email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  isResendConfigured,
  sendEmail,
  sendMediationNoticeEmail,
  sendNextHearingNoticeEmail,
  sendResidentApprovalEmail,
  sendResidentPendingVerificationEmail,
};
