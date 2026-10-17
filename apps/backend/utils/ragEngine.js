const pool = require('../db/pool');

const PUTER_AUTH_TOKEN = process.env.PUTER_AUTH_TOKEN;

// Strict Out-of-Domain Detection Patterns
const OUT_OF_DOMAIN_PATTERNS = [
  /\b(write|generate|debug|code|program|python|javascript|java|c\+\+|html|css|sql|script)\b/i,
  /\b(homework|assignment|algebra|solve this equation|math problem|calculus)\b/i,
  /\b(movie|celebrity|hollywood|netflix|actor|actress|singer|song|album|rap|nba|football|premier league|gaming|fortnite|minecraft)\b/i,
  /\b(joke|riddle|poem|story|fairy tale|weather in (new york|paris|london|tokyo)|capital of)\b/i,
  /\b(crypto|bitcoin|forex|stock market|trading|ethereum)\b/i,
  /\b(who is the president of (the united states|america|france|russia|china))\b/i,
];

const STRICT_OUT_OF_DOMAIN_REPLY =
  "I'm the Barangay AI Assistant. I can only assist with barangay services, complaints, announcements, and other barangay-related concerns. How can I help you with your barangay concern?";

/**
 * Strips markdown symbols (bold **, italics *, headers #, backticks `, blockquotes >, links [x](y), bullets)
 * to output clean, professional plain text for the chatbot.
 */
function stripMarkdown(text) {
  if (!text) return '';
  return String(text)
    // Remove headers (# Title)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italic markers (***text***, **text**, *text*, __text__, _text_)
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Remove inline code and code blocks (`code`, ```code```)
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    // Remove blockquotes (> text)
    .replace(/^\s*>\s+/gm, '')
    // Remove horizontal rules (---, ***, ___)
    .replace(/^(\s*[-*_]){3,}\s*$/gm, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown images ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Replace bullet asterisks (* item) with standard dot bullet (• item)
    .replace(/^\s*\*\s+/gm, '• ')
    // Replace hyphen bullets (- item) with standard dot bullet (• item)
    .replace(/^\s*-\s+/gm, '• ')
    // Remove any leftover lone asterisks or hashes
    .replace(/\*+/g, '')
    .trim();
}

/**
 * 1. RETRIEVAL STEP:
 * Searches chatbot_knowledge, announcements, puroks_zones, and confidential resident complaints.
 */
async function retrieveContext(query, resident = null) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const tokens = cleanQuery
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const contextChunks = [];
  let complaintsFound = [];
  let isComplaintQuery = false;

  // Check if query is asking about complaint status
  if (
    cleanQuery.includes('complaint') ||
    cleanQuery.includes('reklamo') ||
    cleanQuery.includes('case') ||
    cleanQuery.includes('status') ||
    cleanQuery.includes('hearing') ||
    cleanQuery.includes('mediation') ||
    cleanQuery.includes('blotter')
  ) {
    isComplaintQuery = true;
    if (resident && resident.id) {
      // Extract optional case id (e.g. #CASE-2024-089 or 1025)
      const caseMatch = cleanQuery.match(/(CASE-[0-9]{4}-[0-9]{3}|#?[0-9]{3,6})/i);
      const targetCaseId = caseMatch ? caseMatch[0].replace('#', '') : null;

      let q = `
        SELECT id, category, status, filing_date, description, narrative,
               hearing_stage, mediation_date, mediation_time, mediation_venue,
               under_review_at, in_progress_at, resolved_at, created_at
        FROM complaints
        WHERE (filed_by_resident_id = $1 OR LOWER(resident) = LOWER($2))
      `;
      const params = [resident.id, resident.fullName || resident.name || ''];

      if (targetCaseId) {
        q += ` AND (LOWER(id) = LOWER($3) OR id LIKE '%' || $3 || '%')`;
        params.push(targetCaseId);
      }
      q += ` ORDER BY created_at DESC LIMIT 3`;

      const { rows } = await pool.query(q, params);
      complaintsFound = rows;

      if (rows.length > 0) {
        rows.forEach((c) => {
          contextChunks.push({
            id: `complaint-${c.id}`,
            source: 'CONFIDENTIAL_RESIDENT_COMPLAINT_RECORD',
            title: `Case #${c.id} (${c.category || 'General'})`,
            content: `Resident's Case Reference: #${c.id}
Category: ${c.category || 'General'}
Official Current Status: ${c.status}
Filing Date: ${c.filing_date}
Hearing Stage: ${c.hearing_stage || 'Not yet scheduled'}
Mediation Date & Venue: ${c.mediation_date ? `${c.mediation_date} at ${c.mediation_venue || 'Session Hall'}` : 'None'}
Last Database Update: ${c.resolved_at || c.in_progress_at || c.under_review_at || c.created_at}`,
            score: 10,
          });
        });
      }
    }
  }

  // Retrieve official knowledge base items
  const { rows: kbRows } = await pool.query(
    `SELECT id, category, title, keywords, answer_en, answer_fil, answer_ceb
     FROM chatbot_knowledge
     WHERE is_active = true`
  );

  kbRows.forEach((kb) => {
    let score = 0;
    const kwList = Array.isArray(kb.keywords)
      ? kb.keywords
      : typeof kb.keywords === 'string'
      ? JSON.parse(kb.keywords || '[]')
      : [];

    kwList.forEach((kw) => {
      const kwLower = String(kw).toLowerCase();
      if (cleanQuery.includes(kwLower)) score += 3.5;
      tokens.forEach((t) => {
        if (kwLower.includes(t)) score += 1.5;
      });
    });

    const titleLower = kb.title.toLowerCase();
    tokens.forEach((t) => {
      if (titleLower.includes(t)) score += 2;
    });

    if (cleanQuery.includes(kb.category.toLowerCase())) score += 2.5;

    if (score > 2) {
      contextChunks.push({
        id: kb.id,
        source: 'OFFICIAL_KNOWLEDGE_BASE',
        title: kb.title,
        category: kb.category,
        content: `Title: ${kb.title}
Category: ${kb.category}
English Details: ${kb.answer_en}
Filipino/Tagalog Details: ${kb.answer_fil || ''}
Cebuano/Bisaya Details: ${kb.answer_ceb || ''}`,
        score,
        answerEn: kb.answer_en,
        answerFil: kb.answer_fil,
        answerCeb: kb.answer_ceb,
      });
    }
  });

  // Retrieve active announcements
  const { rows: annRows } = await pool.query(
    `SELECT id, title, tag, body, event_date, created_at
     FROM announcements
     ORDER BY created_at DESC
     LIMIT 4`
  );

  annRows.forEach((ann) => {
    let annScore = 0;
    const bodyLower = (ann.title + ' ' + ann.body).toLowerCase();
    tokens.forEach((t) => {
      if (bodyLower.includes(t)) annScore += 1.5;
    });
    if (cleanQuery.includes('announcement') || cleanQuery.includes('event') || cleanQuery.includes('activity')) {
      annScore += 4;
    }

    if (annScore > 2) {
      contextChunks.push({
        id: `ann-${ann.id}`,
        source: 'COMMUNITY_ANNOUNCEMENT',
        title: ann.title,
        content: `Announcement: ${ann.title} [${ann.tag || 'Notice'}]
Details: ${ann.body}
Date: ${ann.event_date || 'Ongoing'}`,
        score: annScore,
      });
    }
  });

  // Sort by score descending and take top 4
  contextChunks.sort((a, b) => b.score - a.score);
  const topChunks = contextChunks.slice(0, 4);

  return {
    topChunks,
    isComplaintQuery,
    complaintsFound,
    hasRelevantContext: topChunks.length > 0,
  };
}

/**
 * 2. AUGMENTATION & GENERATION STEP:
 * Calls Puter AI with augmented verified knowledge prompt and strict guardrails.
 */
async function generateRAGAnswer({
  query,
  language = 'en',
  resident = null,
  conversationHistory = [],
}) {
  const cleanQuery = String(query || '').trim();

  // Guardrail check
  const isOutOfDomain = OUT_OF_DOMAIN_PATTERNS.some((pattern) => pattern.test(cleanQuery));
  if (isOutOfDomain) {
    return {
      reply: STRICT_OUT_OF_DOMAIN_REPLY,
      source: 'guardrail',
      isBarangayDomain: false,
    };
  }

  // 1. Retrieve Knowledge
  const { topChunks, isComplaintQuery, complaintsFound, hasRelevantContext } =
    await retrieveContext(cleanQuery, resident);

  // If asking for personal complaint status while NOT logged in:
  if (isComplaintQuery && !resident && (cleanQuery.toLowerCase().includes('my') || cleanQuery.toLowerCase().includes('status'))) {
    const reply =
      language === 'fil'
        ? 'Maaari kitang tulungang suriin ang estado ng iyong reklamo. Mangyaring mag-sign in muna sa iyong account upang ligtas at opisyal kong makuha ang pinakabagong update mula sa database.'
        : language === 'ceb'
        ? 'Makatabang ko nimo sa pagsusi sa kahimtang sa imong reklamo. Palihog pag-sign in una sa imong account aron opisyal ug pribado nako makuha ang pinakabag-ong update gikan sa database.'
        : 'I can help you check your complaint status. Please sign in to your account and select your complaint so I can retrieve its latest status.';

    return {
      reply,
      requireAuth: true,
      source: 'complaint_tracking',
    };
  }

  // If complaint query authenticated but no complaints found:
  if (isComplaintQuery && resident && complaintsFound.length === 0 && topChunks.length === 0) {
    const notFoundReply =
      language === 'fil'
        ? 'Wala akong nahanap na aktibong reklamo na nakarehistro sa ilalim ng iyong account. Kung naniniwala kang may pagkakamali o kakapag-blotter mo lang sa Barangay Hall, maaari kang mag-iwan ng mensahe sa Barangay Admin dito.'
        : language === 'ceb'
        ? 'Wala koy nakit-an nga aktibong reklamo nga narehistro ubos sa imong account. Kung nagtuo ka nga dunay sayop o bag-o lang ka nagpa-blotter sa Barangay Hall, pwede ka magbilin og mensahe sa Barangay Admin dinhi.'
        : 'I could not find an active complaint registered under your account. If you believe this is an error or recently filed in person at the Barangay Hall, you may message the barangay admin directly here.';

    return {
      reply: notFoundReply,
      canMessageAdmin: true,
      source: 'complaint_tracking',
    };
  }

  // Fallback direct answer if knowledge chunk is exact match and Puter token missing
  const primaryKb = topChunks.find((c) => c.source === 'OFFICIAL_KNOWLEDGE_BASE');
  let fallbackText = '';
  if (primaryKb) {
    fallbackText = primaryKb.answerEn;
    if (language === 'fil' && primaryKb.answerFil) fallbackText = primaryKb.answerFil;
    if (language === 'ceb' && primaryKb.answerCeb) fallbackText = primaryKb.answerCeb;
  }

  // Format context for LLM prompt
  let contextBlock = '';
  if (topChunks.length > 0) {
    contextBlock = topChunks
      .map(
        (c, idx) =>
          `[Source ${idx + 1} (${c.source}) - ${c.title}]\n${c.content}`
      )
      .join('\n\n');
  } else {
    contextBlock = 'NO DIRECT RECORD FOUND IN BARANGAY KNOWLEDGE BASE.';
  }

  // Language instructions
  const langPrompt =
    language === 'fil'
      ? 'Respond in clear, polite, natural Filipino (Tagalog).'
      : language === 'ceb'
      ? 'Respond in clear, polite, natural Cebuano (Bisaya).'
      : 'Respond in clear, polite, professional English.';

  const systemPrompt = `You are the official Barangay Poblacion AI Assistant for Poblacion, Cordova, Cebu, Philippines.
You provide helpful, polite, and accurate information to barangay residents.

STRICT BARANGAY DOMAIN RULES:
1. Scope: Answer questions ONLY related to Barangay Poblacion services, policies, procedures, complaints, announcements, clearances, certificates, officials, office hours, waste management, and peace & order.
2. If the user asks anything outside of barangay matters (programming, homework, entertainment, general knowledge, sports outside barangay), strictly reply:
"I'm the Barangay AI Assistant. I can only assist with barangay services, complaints, announcements, and other barangay-related concerns. How can I help you with your barangay concern?"
3. Anti-Hallucination: Never invent or assume barangay policies, fees, requirements, or announcements. Rely strictly on the VERIFIED CONTEXT provided below.
4. If the required information is unavailable in the verified context, clearly advise the resident to message the barangay admin or visit the Barangay Poblacion Hall (Mon-Fri 8:00 AM - 5:00 PM).
5. Never disclose private records of other residents.
6. ${langPrompt}

7. STRICT FORMATTING: Do NOT use any Markdown formatting in your response. Do NOT use asterisks (no **bold**, no *italics*), do NOT use hashtags (# headers), do NOT use backticks (\`), and do NOT use HTML. Provide clean, professional, plain text only. Use standard round bullets (•) if listing items.

=== VERIFIED BARANGAY POBLACION CONTEXT ===
${contextBlock}
==========================================`;

  // 2. Call Puter AI Chat Completion
  if (PUTER_AUTH_TOKEN) {
    try {
      const messagesPayload = [
        { role: 'system', content: systemPrompt },
      ];

      // Add recent message history if available
      if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        conversationHistory.slice(-4).forEach((m) => {
          messagesPayload.push({
            role: m.sender === 'resident' ? 'user' : 'assistant',
            content: String(m.text || '').substring(0, 300),
          });
        });
      }

      messagesPayload.push({ role: 'user', content: cleanQuery });

      const puterRes = await fetch('https://api.puter.com/drivers/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PUTER_AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          interface: 'puter-chat-completion',
          driver: 'ai-chat',
          method: 'complete',
          args: {
            messages: messagesPayload,
          },
        }),
      });

      const puterData = await puterRes.json();
      if (puterData.success && puterData.result?.message?.content) {
        const generatedContent = stripMarkdown(puterData.result.message.content.trim());
        return {
          reply: generatedContent,
          complaints: complaintsFound.length > 0 ? complaintsFound : null,
          canMessageAdmin: true,
          caseId: complaintsFound.length > 0 ? complaintsFound[0].id : null,
          source: 'rag_llm',
        };
      }
    } catch (err) {
      console.warn('[RAG Engine] LLM generation failed, falling back to deterministic knowledge:', err.message);
    }
  }

  // If LLM was unavailable or no context was found:
  if (fallbackText) {
    return {
      reply: stripMarkdown(fallbackText),
      complaints: complaintsFound.length > 0 ? complaintsFound : null,
      canMessageAdmin: true,
      caseId: complaintsFound.length > 0 ? complaintsFound[0].id : null,
      source: 'knowledge_base_deterministic',
    };
  }

  // Log unanswered query
  await pool.query(
    `INSERT INTO chatbot_unanswered_logs (id, resident_id, resident_name, query, language, status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'pending_review', now())`,
    [
      `unans-${Date.now()}`,
      resident ? resident.id : null,
      resident ? (resident.fullName || resident.name) : 'Guest Resident',
      cleanQuery,
      language,
    ]
  );

  const fallbackUnanswered =
    language === 'fil'
      ? 'Paumanhin, wala pa akong beripikadong tala sa opisyal na database ng barangay para sa katanungang ito. Maaari kang magpadala ng direktang mensahe sa Barangay Admin dito o bumisita sa Barangay Poblacion Hall (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM).'
      : language === 'ceb'
      ? 'Pasayloa, wala pa koy opisyal nga talaan sa database sa barangay mahitungod niini. Pwede ka magpadala og direktang mensahe sa Barangay Admin dinhi o mobisita sa Barangay Poblacion Hall (Lunes hangtod Biyernes, 8:00 AM - 5:00 PM).'
      : "I don't have verified records regarding that specific inquiry in our barangay database. For official guidance, you may message the barangay admin directly here or visit the Barangay Poblacion Hall (Mon-Fri 8:00 AM - 5:00 PM).";

  return {
    reply: stripMarkdown(fallbackUnanswered),
    canMessageAdmin: true,
    source: 'unanswered_fallback',
  };
}

module.exports = {
  retrieveContext,
  generateRAGAnswer,
};
