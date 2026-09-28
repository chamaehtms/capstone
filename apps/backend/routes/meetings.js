const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { sendMediationNoticeEmail, sendNextHearingNoticeEmail } = require('../utils/mailer');

const router = express.Router();
router.use(requireAuth);

function toMeeting(m) {
  return {
    id: m.id,
    title: m.title,
    date: m.date,
    time: m.time,
    location: m.location,
    attendees: m.attendees || [],
    absentees: m.absentees || [],
    agenda: m.agenda || [],
    mainTopics: m.main_topics || [],
    concernsRaised: m.concerns_raised || '',
    minutes: m.minutes || '',
    resolutions: m.resolutions || [],
    actionItems: m.action_items || [],
    nextMeetingDate: m.next_meeting_date || '',
    nextMeetingTime: m.next_meeting_time || '',
    nextMeetingVenue: m.next_meeting_venue || '',
    meetingType: m.meeting_type || 'council',
    caseId: m.case_id || null,
    residentId: m.resident_id || null,
    residentName: m.resident_name || '',
    residentEmail: m.resident_email || '',
    respondentName: m.respondent_name || '',
    mediator: m.mediator || '',
    hearingStage: m.hearing_stage || '1st Mediation Hearing',
    notificationSent: !!m.notification_sent,
    notificationSentAt: m.notification_sent_at || null,
    nextNotificationSent: !!m.next_notification_sent,
    nextNotificationSentAt: m.next_notification_sent_at || null,
    createdAt: m.created_at,
  };
}

// GET /api/meetings
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    const conditions = [];
    const params = [];

    if (type && type !== 'all') {
      params.push(type);
      conditions.push(`meeting_type = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(title) LIKE $${params.length} OR LOWER(COALESCE(case_id, '')) LIKE $${params.length} OR LOWER(COALESCE(resident_name, '')) LIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM meetings ${where} ORDER BY date DESC, created_at DESC`,
      params
    );
    res.json(rows.map(toMeeting));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading meetings.' });
  }
});

// GET /api/meetings/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Meeting not found.' });
    res.json(toMeeting(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading meeting.' });
  }
});

// POST /api/meetings
router.post('/', async (req, res) => {
  try {
    let {
      title,
      date,
      time,
      location,
      agenda,
      attendees,
      absentees,
      mainTopics,
      concernsRaised,
      minutes,
      resolutions,
      actionItems,
      nextMeetingDate,
      nextMeetingTime,
      nextMeetingVenue,
      meetingType = 'council',
      caseId,
      residentId,
      residentName,
      residentEmail,
      respondentName,
      mediator,
      hearingStage = '1st Mediation Hearing',
      sendNotification = true,
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({ message: 'Title and date are required.' });
    }

    // If linked to a case, auto-populate any missing complainant/respondent info
    if (caseId) {
      const { rows: compRows } = await pool.query(
        `SELECT c.*, r.email AS resident_acc_email, r.full_name AS resident_acc_name
         FROM complaints c
         LEFT JOIN residents r ON (r.id = c.filed_by_resident_id OR LOWER(TRIM(r.full_name)) = LOWER(TRIM(c.resident)))
         WHERE c.id = $1`,
        [caseId]
      );
      if (compRows.length > 0) {
        const comp = compRows[0];
        residentName = residentName || comp.resident || comp.resident_acc_name || '';
        residentEmail = residentEmail || comp.resident_acc_email || '';
        respondentName = respondentName || comp.respondent || '';
        residentId = residentId || comp.filed_by_resident_id || null;
      }
    }

    // If residentEmail is still missing but residentName is present, lookup registered resident by name
    if (!residentEmail && residentName) {
      const { rows: rRows } = await pool.query(
        `SELECT id, email, full_name FROM residents
         WHERE (LOWER(TRIM(full_name)) = LOWER(TRIM($1)) OR LOWER(TRIM(full_name)) LIKE LOWER(TRIM($2)))
           AND email IS NOT NULL AND email <> ''
         ORDER BY (LOWER(TRIM(full_name)) = LOWER(TRIM($1))) DESC
         LIMIT 1`,
        [residentName, `%${residentName}%`]
      );
      if (rRows.length > 0) {
        residentEmail = rRows[0].email;
        residentId = residentId || rRows[0].id;
      }
    }

    const id = `mtg-${uuidv4().slice(0, 8)}`;
    const venue = location || (meetingType === 'mediation' ? 'Barangay Poblacion Mediation Hall' : 'Barangay Poblacion Session Hall');

    const { rows } = await pool.query(
      `INSERT INTO meetings
        (id, title, date, time, location, attendees, absentees, agenda, main_topics, concerns_raised,
         minutes, resolutions, action_items, next_meeting_date, next_meeting_time, next_meeting_venue,
         meeting_type, case_id, resident_id, resident_name, resident_email, respondent_name, mediator,
         hearing_stage, notification_sent, notification_sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,false,null)
       RETURNING *`,
      [
        id,
        title,
        date,
        time || '',
        venue,
        JSON.stringify(attendees || []),
        JSON.stringify(absentees || []),
        JSON.stringify(agenda || []),
        JSON.stringify(mainTopics || []),
        concernsRaised || '',
        minutes || '',
        JSON.stringify(resolutions || []),
        JSON.stringify(actionItems || []),
        nextMeetingDate || '',
        nextMeetingTime || '',
        nextMeetingVenue || '',
        meetingType,
        caseId || null,
        residentId || null,
        residentName || '',
        residentEmail || '',
        respondentName || '',
        mediator || '',
        hearingStage,
      ]
    );

    let createdMeeting = rows[0];

    // If linked to a case, update the complaint status and mediation schedule
    if (caseId) {
      await pool.query(
        `UPDATE complaints
         SET status = 'Mediation',
             under_review_at = COALESCE(under_review_at, now()),
             mediation_date = $1,
             mediation_time = $2,
             mediation_venue = $3,
             mediator = $4,
             hearing_stage = $5,
             next_mediation_date = $6,
             next_mediation_time = $7,
             next_mediation_venue = $8
         WHERE id = $9`,
        [
          date,
          time || '',
          venue,
          mediator || '',
          hearingStage,
          nextMeetingDate || '',
          nextMeetingTime || '',
          nextMeetingVenue || '',
          caseId,
        ]
      );
    }

    // Send email notification to resident if requested for primary hearing
    let mailResult = { success: false, reason: 'Notification not requested or recipient email missing' };
    if (sendNotification && residentEmail) {
      mailResult = await sendMediationNoticeEmail({
        to: residentEmail,
        residentName,
        respondentName,
        caseId,
        date,
        time,
        venue,
        mediator,
        hearingStage,
        notes: concernsRaised || minutes || '',
      });

      if (mailResult.success) {
        const { rows: updatedRows } = await pool.query(
          `UPDATE meetings
           SET notification_sent = true, notification_sent_at = now()
           WHERE id = $1
           RETURNING *`,
          [id]
        );
        if (updatedRows.length > 0) createdMeeting = updatedRows[0];
      }

      // Add in-app notification for initial mediation hearing
      try {
        await pool.query(
          `INSERT INTO notifications (id, resident_id, resident_email, case_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `notif-${uuidv4().slice(0, 8)}`,
            residentId || null,
            residentEmail || null,
            caseId || null,
            `⚖️ Mediation Hearing: ${hearingStage || 'Lupon Session'}`,
            `Notice of hearing for ${caseId || 'your case'}: ${date}${time ? ` at ${time}` : ''} at ${venue}.`,
            'mediation',
            caseId ? `/track?ref=${encodeURIComponent(caseId)}` : '/track',
          ]
        );
      } catch (notifErr) {
        console.error('[notifications] Failed to insert initial hearing notification:', notifErr.message);
      }
    }

    // If a next hearing session is already designated upon creation, notify the resident
    let nextMailResult = null;
    if (nextMeetingDate && residentEmail) {
      nextMailResult = await sendNextHearingNoticeEmail({
        to: residentEmail,
        residentName,
        respondentName,
        caseId,
        nextMeetingDate,
        nextMeetingTime,
        nextMeetingVenue,
        mediator,
        hearingStage,
        notes: concernsRaised || (resolutions && resolutions.length ? `Agreed terms: ${resolutions.map((r) => r.title).join('; ')}` : ''),
      });

      if (nextMailResult.success) {
        const { rows: nextUpRows } = await pool.query(
          `UPDATE meetings
           SET next_notification_sent = true, next_notification_sent_at = now()
           WHERE id = $1
           RETURNING *`,
          [id]
        );
        if (nextUpRows.length > 0) createdMeeting = nextUpRows[0];
      }

      try {
        await pool.query(
          `INSERT INTO notifications (id, resident_id, resident_email, case_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `notif-${uuidv4().slice(0, 8)}`,
            residentId || null,
            residentEmail || null,
            caseId || null,
            '🗓️ Next Mediation Hearing Scheduled',
            `Your follow-up mediation session for ${caseId ? `Case #${caseId}` : 'your case'} is scheduled on ${nextMeetingDate}${nextMeetingTime ? ` at ${nextMeetingTime}` : ''} at ${nextMeetingVenue || 'Barangay Poblacion Mediation Hall'}.`,
            'next_hearing',
            caseId ? `/track?ref=${encodeURIComponent(caseId)}` : '/track',
          ]
        );
      } catch (notifErr) {
        console.error('[notifications] Failed to insert next hearing notification:', notifErr.message);
      }
    }

    res.status(201).json({
      ...toMeeting(createdMeeting),
      emailSent: mailResult.success,
      emailError: mailResult.error,
      nextEmailSent: nextMailResult ? nextMailResult.success : undefined,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error creating meeting: ' + (err.message || 'Server error') });
  }
});

// PUT /api/meetings/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Meeting not found.' });

    const existing = toMeeting(existingRows[0]);
    const merged = { ...existing, ...req.body };

    // Auto-resolve resident details if missing
    if ((!merged.residentEmail || !merged.residentId) && merged.caseId) {
      const { rows: compRows } = await pool.query(
        `SELECT c.*, r.email AS resident_acc_email, r.id AS resident_acc_id, r.full_name AS resident_acc_name
         FROM complaints c
         LEFT JOIN residents r ON (r.id = c.filed_by_resident_id OR LOWER(TRIM(r.full_name)) = LOWER(TRIM(c.resident)))
         WHERE c.id = $1`,
        [merged.caseId]
      );
      if (compRows.length > 0) {
        const comp = compRows[0];
        merged.residentName = merged.residentName || comp.resident || comp.resident_acc_name || '';
        merged.residentEmail = merged.residentEmail || comp.resident_acc_email || '';
        merged.residentId = merged.residentId || comp.filed_by_resident_id || comp.resident_acc_id || null;
        merged.respondentName = merged.respondentName || comp.respondent || '';
      }
    }

    if (!merged.residentEmail && merged.residentName) {
      const { rows: rRows } = await pool.query(
        `SELECT id, email, full_name FROM residents
         WHERE (LOWER(TRIM(full_name)) = LOWER(TRIM($1)) OR LOWER(TRIM(full_name)) LIKE LOWER(TRIM($2)))
           AND email IS NOT NULL AND email <> ''
         ORDER BY (LOWER(TRIM(full_name)) = LOWER(TRIM($1))) DESC
         LIMIT 1`,
        [merged.residentName, `%${merged.residentName}%`]
      );
      if (rRows.length > 0) {
        merged.residentEmail = rRows[0].email;
        merged.residentId = merged.residentId || rRows[0].id;
      }
    }

    const { rows } = await pool.query(
      `UPDATE meetings
       SET title=$1, date=$2, time=$3, location=$4, attendees=$5, absentees=$6,
           agenda=$7, main_topics=$8, concerns_raised=$9, minutes=$10, resolutions=$11,
           action_items=$12, next_meeting_date=$13, next_meeting_time=$14, next_meeting_venue=$15,
           meeting_type=$16, case_id=$17, resident_id=$18, resident_name=$19,
           resident_email=$20, respondent_name=$21, mediator=$22, hearing_stage=$23
       WHERE id=$24 RETURNING *`,
      [
        merged.title,
        merged.date,
        merged.time,
        merged.location,
        JSON.stringify(merged.attendees || []),
        JSON.stringify(merged.absentees || []),
        JSON.stringify(merged.agenda || []),
        JSON.stringify(merged.mainTopics || []),
        merged.concernsRaised || '',
        merged.minutes || '',
        JSON.stringify(merged.resolutions || []),
        JSON.stringify(merged.actionItems || []),
        merged.nextMeetingDate || '',
        merged.nextMeetingTime || '',
        merged.nextMeetingVenue || '',
        merged.meetingType || 'council',
        merged.caseId || null,
        merged.residentId || null,
        merged.residentName || '',
        merged.residentEmail || '',
        merged.respondentName || '',
        merged.mediator || '',
        merged.hearingStage || '1st Mediation Hearing',
        req.params.id,
      ]
    );

    let updatedMeeting = rows[0];

    // If caseId is present, sync with complaints
    if (merged.caseId) {
      await pool.query(
        `UPDATE complaints
         SET mediation_date = $1,
             mediation_time = $2,
             mediation_venue = $3,
             mediator = $4,
             hearing_stage = $5,
             next_mediation_date = $6,
             next_mediation_time = $7,
             next_mediation_venue = $8
         WHERE id = $9`,
        [
          merged.date,
          merged.time || '',
          merged.location || '',
          merged.mediator || '',
          merged.hearingStage,
          merged.nextMeetingDate || '',
          merged.nextMeetingTime || '',
          merged.nextMeetingVenue || '',
          merged.caseId,
        ]
      );
    }

    // Trigger Notification for Next Session / Follow-up Hearing (Section 7)
    let nextMailResult = null;
    const hasNextDate = Boolean(merged.nextMeetingDate && String(merged.nextMeetingDate).trim());
    const nextSessionChangedOrRequested = hasNextDate && (
      merged.nextMeetingDate !== existing.nextMeetingDate ||
      merged.nextMeetingTime !== existing.nextMeetingTime ||
      merged.nextMeetingVenue !== existing.nextMeetingVenue ||
      !existing.nextMeetingDate ||
      req.body.sendNotification ||
      req.body.resendNextNotification ||
      req.body.sendNextNotification
    );

    if (hasNextDate && nextSessionChangedOrRequested) {
      if (merged.residentEmail) {
        nextMailResult = await sendNextHearingNoticeEmail({
          to: merged.residentEmail,
          residentName: merged.residentName,
          respondentName: merged.respondentName,
          caseId: merged.caseId,
          nextMeetingDate: merged.nextMeetingDate,
          nextMeetingTime: merged.nextMeetingTime,
          nextMeetingVenue: merged.nextMeetingVenue,
          mediator: merged.mediator,
          hearingStage: merged.hearingStage,
          notes: merged.concernsRaised || (merged.resolutions && merged.resolutions.length ? `Agreements: ${merged.resolutions.map((r) => r.title).join('; ')}` : ''),
        });

        if (nextMailResult.success) {
          const { rows: reUpdated } = await pool.query(
            'UPDATE meetings SET next_notification_sent = true, next_notification_sent_at = now() WHERE id = $1 RETURNING *',
            [req.params.id]
          );
          if (reUpdated.length > 0) updatedMeeting = reUpdated[0];
        }
      }

      // Add in-app notification for the resident's user account
      try {
        await pool.query(
          `INSERT INTO notifications (id, resident_id, resident_email, case_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `notif-${uuidv4().slice(0, 8)}`,
            merged.residentId || null,
            merged.residentEmail || null,
            merged.caseId || null,
            '🗓️ Next Mediation Hearing Scheduled',
            `Your follow-up mediation session for ${merged.caseId ? `Case #${merged.caseId}` : 'your case'} is scheduled on ${merged.nextMeetingDate}${merged.nextMeetingTime ? ` at ${merged.nextMeetingTime}` : ''} at ${merged.nextMeetingVenue || 'Barangay Poblacion Mediation Hall'}.`,
            'next_hearing',
            merged.caseId ? `/track?ref=${encodeURIComponent(merged.caseId)}` : '/track',
          ]
        );
      } catch (notifErr) {
        console.error('[notifications] Failed to insert next hearing notification:', notifErr.message);
      }
    }

    // Optional resend notification for primary hearing
    let mailResult = null;
    if (req.body.resendNotification && merged.residentEmail) {
      mailResult = await sendMediationNoticeEmail({
        to: merged.residentEmail,
        residentName: merged.residentName,
        respondentName: merged.respondentName,
        caseId: merged.caseId,
        date: merged.date,
        time: merged.time,
        venue: merged.location,
        mediator: merged.mediator,
        hearingStage: merged.hearingStage,
        notes: merged.concernsRaised || merged.minutes || '',
      });

      if (mailResult.success) {
        const { rows: reUpdated } = await pool.query(
          'UPDATE meetings SET notification_sent = true, notification_sent_at = now() WHERE id = $1 RETURNING *',
          [req.params.id]
        );
        if (reUpdated.length > 0) updatedMeeting = reUpdated[0];
      }
    }

    res.json({
      ...toMeeting(updatedMeeting),
      emailSent: mailResult ? mailResult.success : undefined,
      nextEmailSent: nextMailResult ? nextMailResult.success : undefined,
      nextEmailError: nextMailResult?.error,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating meeting: ' + (err.message || 'Server error') });
  }
});

// POST /api/meetings/:id/resend-notification
router.post('/:id/resend-notification', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Meeting not found.' });

    const meeting = toMeeting(rows[0]);
    if (!meeting.residentEmail) {
      return res.status(400).json({ message: 'No complainant email recorded for this meeting.' });
    }

    const isNext = req.body.type === 'next' || req.query.type === 'next';

    if (isNext) {
      if (!meeting.nextMeetingDate) {
        return res.status(400).json({ message: 'No next session date has been scheduled for this meeting.' });
      }

      const mailResult = await sendNextHearingNoticeEmail({
        to: meeting.residentEmail,
        residentName: meeting.residentName,
        respondentName: meeting.respondentName,
        caseId: meeting.caseId,
        nextMeetingDate: meeting.nextMeetingDate,
        nextMeetingTime: meeting.nextMeetingTime,
        nextMeetingVenue: meeting.nextMeetingVenue,
        mediator: meeting.mediator,
        hearingStage: meeting.hearingStage,
        notes: meeting.concernsRaised || (meeting.resolutions && meeting.resolutions.length ? `Agreed terms: ${meeting.resolutions.map((r) => r.title).join('; ')}` : ''),
      });

      if (!mailResult.success) {
        return res.status(500).json({ message: 'Failed to send next session notification email: ' + (mailResult.error || mailResult.reason) });
      }

      await pool.query(
        'UPDATE meetings SET next_notification_sent = true, next_notification_sent_at = now() WHERE id = $1',
        [req.params.id]
      );

      // Also ensure in-app notification is registered
      try {
        await pool.query(
          `INSERT INTO notifications (id, resident_id, resident_email, case_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `notif-${uuidv4().slice(0, 8)}`,
            meeting.residentId || null,
            meeting.residentEmail || null,
            meeting.caseId || null,
            '🗓️ Next Mediation Hearing Scheduled',
            `Your follow-up mediation session for ${meeting.caseId ? `Case #${meeting.caseId}` : 'your case'} is scheduled on ${meeting.nextMeetingDate}${meeting.nextMeetingTime ? ` at ${meeting.nextMeetingTime}` : ''} at ${meeting.nextMeetingVenue || 'Barangay Poblacion Mediation Hall'}.`,
            'next_hearing',
            meeting.caseId ? `/track?ref=${encodeURIComponent(meeting.caseId)}` : '/track',
          ]
        );
      } catch (notifErr) {
        console.error('[notifications] Failed to insert notification on resend:', notifErr.message);
      }

      return res.json({ message: `Next session notification email sent successfully to ${meeting.residentEmail}!` });
    }

    const mailResult = await sendMediationNoticeEmail({
      to: meeting.residentEmail,
      residentName: meeting.residentName,
      respondentName: meeting.respondentName,
      caseId: meeting.caseId,
      date: meeting.date,
      time: meeting.time,
      venue: meeting.location,
      mediator: meeting.mediator,
      hearingStage: meeting.hearingStage,
      notes: meeting.concernsRaised || meeting.minutes || '',
    });

    if (!mailResult.success) {
      return res.status(500).json({ message: 'Failed to send notification email: ' + (mailResult.error || mailResult.reason) });
    }

    await pool.query(
      'UPDATE meetings SET notification_sent = true, notification_sent_at = now() WHERE id = $1',
      [req.params.id]
    );

    res.json({ message: `Notification email sent successfully to ${meeting.residentEmail}!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error resending notification.' });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM meetings WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Meeting not found.' });
    res.json({ message: 'Meeting deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error deleting meeting.' });
  }
});

module.exports = router;
