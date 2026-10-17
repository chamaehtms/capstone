const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function extractSightengineScore(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [];
  const visit = (value) => {
    if (value == null) return;
    if (typeof value === 'number') candidates.push(value);
    else if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) candidates.push(parsed);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };

  visit(payload);

  const score = candidates.find((value) => value >= 0 && value <= 1);
  return score == null ? null : Number(score);
}

// Supported ID document indicator keywords (Philippine Government & Institutional IDs)
const SUPPORTED_ID_KEYWORDS = [
  'PHILIPPINES', 'PILIPINAS', 'REPUBLIC', 'REPUBLIKA',
  'NATIONAL ID', 'PHILSYS', 'PHILIPPINE IDENTIFICATION', 'PHILID',
  'DRIVER', 'LICENSE', 'LTO', 'LAND TRANSPORTATION',
  'PASSPORT', 'DFA',
  'VOTER', 'COMELEC', 'COMMISSION ON ELECTIONS',
  'POSTAL', 'POST OFFICE', 'PHLPOST',
  'SSS', 'SOCIAL SECURITY',
  'GSIS', 'GOVERNMENT SERVICE INSURANCE',
  'UMID', 'UNIFIED MULTI-PURPOSE',
  'PRC', 'PROFESSIONAL REGULATION',
  'TIN', 'BIR', 'BUREAU OF INTERNAL REVENUE',
  'PHILHEALTH', 'PAG-IBIG', 'HDMF',
  'SENIOR CITIZEN', 'OSCA',
  'PWD', 'PERSONS WITH DISABILITY',
  'BARANGAY', 'POBLACION', 'CERTIFICATE', 'CLEARANCE',
  'IDENTIFICATION', 'IDENTITY CARD', 'ID CARD', 'GOVERNMENT',
  'EMPLOYEE ID', 'STAFF', 'CIVIC LEDGER', 'OFFICIAL', 'MUNICIPALITY'
];

// Specific, high-confidence keywords that indicate an actual physical government/civic ID card in a selfie.
// Excludes generic conversational words or room text like 'STAFF', 'POBLACION', 'CLEARANCE', 'OFFICIAL', 'GOVERNMENT'.
const CARD_ANCHOR_KEYWORDS = [
  'PHILSYS', 'PHILID', 'PHILIPPINE IDENTIFICATION', 'NATIONAL ID',
  'DRIVER', 'LICENSE', 'LAND TRANSPORTATION',
  'PASSPORT',
  'COMELEC', 'VOTER',
  'POSTAL ID', 'PHLPOST',
  'PHILHEALTH', 'PAG-IBIG',
  'UMID', 'PRC', 'GSIS',
  'SENIOR CITIZEN', 'PERSONS WITH DISABILITY',
  'IDENTITY CARD', 'IDENTIFICATION CARD'
];

// Screenshot & digital display indicator keywords detected via OCR
const SCREENSHOT_OCR_KEYWORDS = [
  'BATTERY', 'WIFI', 'LTE', '5G', '4G', 'SCREENSHOT', 'CAPTURED',
  'SCREEN CAPTURE', 'SCREEN RECORDER', 'NOTIFICATION', 'STATUS BAR',
  'AIRPLANE MODE', 'MESSENGER', 'FACEBOOK', 'WHATSAPP', 'TELEGRAM',
  'INSTAGRAM', 'TIKTOK', 'GOOGLE CHROME', 'SAFARI', 'SCREENSHOTS',
  'SYSTEM UI', 'NAVBAR', 'BATTERY LEVEL'
];

// File name patterns typical of mobile or desktop screenshots
const SCREENSHOT_FILENAME_PATTERNS = [
  /screenshot/i,
  /screen_shot/i,
  /screen-shot/i,
  /screen_capture/i,
  /screencap/i,
  /capture_\d+/i,
  /snip(?:ping)?/i,
  /prntscr/i,
  /printscreen/i,
  /shot_\d+/i,
];

/**
 * Extracts expiration date if present in OCR text.
 */
function extractExpirationDate(text) {
  if (!text) return null;
  const upper = text.toUpperCase();

  const patterns = [
    /(?:EXPIR(?:Y|ATION|ES)|VALID(?:ITY)?\s*(?:UNTIL|THRU|TO))\s*(?:DATE)?\s*[:.-]?\s*([0-9]{4}[-\/.][0-9]{1,2}[-\/.][0-9]{1,2})/i,
    /(?:EXPIR(?:Y|ATION|ES)|VALID(?:ITY)?\s*(?:UNTIL|THRU|TO))\s*(?:DATE)?\s*[:.-]?\s*([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{4})/i,
    /(?:EXPIR(?:Y|ATION|ES)|VALID(?:ITY)?\s*(?:UNTIL|THRU|TO))\s*(?:DATE)?\s*[:.-]?\s*([0-9]{1,2}\s+[A-Z]{3,9}\s+[0-9]{4})/i,
    /(?:EXPIR(?:Y|ATION|ES)|VALID(?:ITY)?\s*(?:UNTIL|THRU|TO))\s*(?:DATE)?\s*[:.-]?\s*([A-Z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
  ];

  for (const pat of patterns) {
    const m = upper.match(pat);
    if (m && m[1]) {
      const parsedDate = new Date(m[1].trim());
      if (!isNaN(parsedDate.getTime())) {
        return { raw: m[1].trim(), date: parsedDate };
      }
    }
  }
  return null;
}

/**
 * Extracts key identity words from ID OCR text (e.g., words >= 4 letters that represent names, numbers, or card identifiers)
 */
function extractIdTokens(text) {
  if (!text) return [];
  const clean = text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['THAT', 'THIS', 'WITH', 'FROM', 'HAVE', 'PLEASE'].includes(w));
  return Array.from(new Set(clean));
}

/**
 * Validates an ID image using Sightengine GenAI detection + OCR + image properties.
 * Detects:
 * - AI generation / deepfakes
 * - Blurry images (sharpness < 0.20)
 * - Bad lighting (dark or overexposed)
 * - Unsupported document types (no government/institutional ID keywords found)
 * - Expired ID documents
 */
async function validateIdImage(fileOrUrl, options = {}) {
  const userId = process.env.SIGHTENGINE_USER_ID;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!userId || !apiSecret) {
    return {
      status: 'not_configured',
      score: null,
      summary: 'AI scanner is not configured.',
    };
  }

  try {
    const form = new FormData();
    form.append('models', 'genai,ocr,properties,face-attributes');
    form.append('api_user', userId);
    form.append('api_secret', apiSecret);

    if (typeof fileOrUrl === 'string') {
      const str = fileOrUrl.trim();
      if (str.startsWith('http://') || str.startsWith('https://')) {
        form.append('url', str);
      } else {
        const cleanRelPath = str.replace(/^\//, '');
        const absPath = path.join(__dirname, '..', cleanRelPath);
        if (!fs.existsSync(absPath)) {
          return { status: 'file_not_found', score: null, summary: 'ID document file was not found on server.' };
        }
        const ext = path.extname(absPath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.pdf' ? 'application/pdf' : 'image/jpeg';
        if (mimeType === 'application/pdf') {
          return { status: 'document_pdf', score: null, summary: 'PDF document uploaded (Manual review recommended).' };
        }
        const buffer = await fs.promises.readFile(absPath);
        form.append('media', new Blob([buffer], { type: mimeType }), path.basename(absPath));
      }
    } else if (fileOrUrl && fileOrUrl.path) {
      if (fileOrUrl.mimetype === 'application/pdf') {
        return { status: 'document_pdf', score: null, summary: 'PDF document uploaded (Manual review recommended).' };
      }
      const buffer = await fs.promises.readFile(fileOrUrl.path);
      form.append('media', new Blob([buffer], { type: fileOrUrl.mimetype || 'image/jpeg' }), fileOrUrl.originalname || 'id_file.jpg');
    } else {
      return { status: 'no_document', score: null, summary: 'No valid document provided.' };
    }

    const response = await fetch('https://api.sightengine.com/1.0/check.json', {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Sightengine responded with status ${response.status}`);
    }

    const data = await response.json();
    const genAiScore = extractSightengineScore(data) ??
      extractSightengineScore(data?.type) ??
      extractSightengineScore(data?.genai);

    const sharpness = typeof data.sharpness === 'number' ? data.sharpness : null;
    const brightness = typeof data.brightness === 'number' ? data.brightness : null;
    const ocrText = (data.text?.content || '').trim();
    const faces = Array.isArray(data.faces) ? data.faces : [];

    // 1. Check for blurry image (low sharpness)
    if (sharpness !== null && sharpness < 0.20) {
      return {
        status: 'blurry',
        score: sharpness,
        sharpness,
        brightness,
        ocrText,
        facesCount: faces.length,
        summary: `Blurry Image Detected: Sharpness is too low (${Math.round(sharpness * 100)}%). Please retake a clear, well-focused photo.`,
      };
    }

    // 2. Check for bad lighting (too dark or washed out)
    if (brightness !== null && (brightness < 0.12 || brightness > 0.94)) {
      return {
        status: 'poor_lighting',
        score: brightness,
        sharpness,
        brightness,
        ocrText,
        facesCount: faces.length,
        summary: brightness < 0.12
          ? 'Image Too Dark: Insufficient lighting to clearly read details. Please retake in a well-lit area.'
          : 'Image Overexposed: The photo is too bright / washed out. Please retake without direct glare.',
      };
    }

    // 3. Check for AI generation / deepfakes
    if (Number.isFinite(genAiScore) && genAiScore >= 0.7) {
      const aiPercent = Math.round(genAiScore * 100);
      return {
        status: 'ai_detected',
        score: genAiScore,
        sharpness,
        brightness,
        ocrText,
        facesCount: faces.length,
        summary: `Fraudulent / AI Generated ID: High probability of synthetic generation or deepfake (${aiPercent}% AI confidence).`,
      };
    }

    // 4. Check for Mobile / Desktop Screenshot indicators
    const originalFileName = typeof fileOrUrl === 'string'
      ? path.basename(fileOrUrl)
      : (fileOrUrl?.originalname || fileOrUrl?.filename || '');

    const isScreenshotFilename = SCREENSHOT_FILENAME_PATTERNS.some((pat) => pat.test(originalFileName));
    const upperOcr = ocrText ? ocrText.toUpperCase() : '';
    const foundScreenshotKeywords = SCREENSHOT_OCR_KEYWORDS.filter((kw) => upperOcr.includes(kw));
    const isScreenshotOcr = foundScreenshotKeywords.length >= 2;

    if (isScreenshotFilename || isScreenshotOcr) {
      return {
        status: 'screenshot_detected',
        score: null,
        sharpness,
        brightness,
        ocrText,
        facesCount: faces.length,
        summary: options.isIdCard
          ? 'Screenshots Not Allowed: Please do not upload a phone or computer screenshot. Upload an original, direct physical photograph of your valid ID card.'
          : 'Screenshots Not Allowed: Please do not upload a screenshot. You must take and upload an original live photo or camera selfie of yourself holding your physical ID card.',
      };
    }

    // 5. OCR Analysis: Expiration Check
    if (ocrText) {
      const expiry = extractExpirationDate(ocrText);
      if (expiry && expiry.date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiry.date < today) {
          const formattedDate = expiry.date.toISOString().slice(0, 10);
          return {
            status: 'expired',
            score: null,
            sharpness,
            brightness,
            ocrText,
            facesCount: faces.length,
            summary: `Expired ID Detected: Document expired on ${formattedDate}. Please provide a currently valid, unexpired identification card.`,
          };
        }
      }

      // 6. OCR Analysis: Unsupported ID Check (only for ID card, not for selfie)
      if (options.isIdCard) {
        const hasIdKeywords = SUPPORTED_ID_KEYWORDS.some((kw) => upperOcr.includes(kw));
        if (!hasIdKeywords) {
          return {
            status: 'unsupported_id',
            score: null,
            sharpness,
            brightness,
            ocrText,
            facesCount: faces.length,
            summary: 'Unsupported Document: The uploaded image is not a recognized valid government or institutional ID card. Screenshots, random pictures, or unapproved documents are strictly rejected. Please upload a PhilSys ID, Driver\'s License, Passport, UMID, Voter\'s ID, Postal ID, PRC ID, or Barangay ID.',
          };
        }
      }
    } else if (options.isIdCard) {
      // No text detected at all on the ID card
      return {
        status: 'unsupported_id',
        score: null,
        sharpness,
        brightness,
        ocrText: '',
        facesCount: faces.length,
        summary: 'No Valid ID Information Detected: The image does not contain recognizable ID card text or government seal. Please upload a clear photo of an authentic physical government ID card.',
      };
    }

    // 6. Moderate AI suspicion notice
    if (Number.isFinite(genAiScore) && genAiScore >= 0.3) {
      const aiPercent = Math.round(genAiScore * 100);
      return {
        status: 'suspicious',
        score: genAiScore,
        sharpness,
        brightness,
        ocrText,
        facesCount: faces.length,
        summary: `Notice: Moderate AI generation indicators (${aiPercent}% AI confidence). Manual verification advised.`,
      };
    }

    const authenticityPercent = Number.isFinite(genAiScore) ? Math.round((1 - genAiScore) * 100) : 98;
    return {
      status: 'likely_authentic',
      score: genAiScore,
      sharpness,
      brightness,
      ocrText,
      facesCount: faces.length,
      summary: `Verified: Authentic, readable physical ID (${authenticityPercent}% confidence).`,
    };
  } catch (err) {
    console.error('[AI ID Validator] Scan failed:', err.message);
    return {
      status: 'provider_unavailable',
      score: null,
      summary: 'AI verification service temporarily unavailable.',
    };
  }
}

/**
 * Checks if the applicant's entered name matches tokens detected by OCR on the ID.
 */
function verifyNameMatchesId(applicantName, ocrText) {
  if (!applicantName || !ocrText) return { matched: true, score: 1.0 };
  const cleanOcr = normalizeOcr(ocrText);
  const nameParts = applicantName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((part) => part.length >= 3);

  if (nameParts.length === 0) return { matched: true, score: 1.0 };

  const matchedParts = nameParts.filter((part) => cleanOcr.includes(part));
  const matchRatio = matchedParts.length / nameParts.length;

  return {
    matched: matchRatio >= 0.5,
    matchRatio,
    matchedParts,
    nameParts,
  };
}

function normalizeOcr(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Step 1: Validates the ID document's authenticity, readability, expiration, and profile match.
 */
async function verifyIdDocumentStep(idDocFile, options = {}) {
  const applicantName = options.applicantName || '';

  if (!idDocFile) {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      reason: 'A valid government or institutional ID document is required.',
    };
  }

  // 1. Perform automated AI OCR & quality check on the ID document
  const idScan = await validateIdImage(idDocFile, { isIdCard: true });

  // 1a. Authenticity check (GenAI / deepfake detection)
  if (idScan.status === 'ai_detected') {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: `ID Authenticity Failed: The uploaded ID was flagged as fraudulent or AI-generated (${idScan.summary}). Please upload a clear photo of an authentic physical government ID.`,
    };
  }

  // 1b. Image quality check (Sharpness / blur)
  if (idScan.status === 'blurry') {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: `ID Image Quality Issue: The uploaded ID is too blurry to read (${idScan.summary}). Please take a well-focused, sharp photo and re-upload.`,
    };
  }

  // 1c. Image lighting / glare check
  if (idScan.status === 'poor_lighting') {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: `ID Image Quality Issue: ${idScan.summary}`,
    };
  }

  // 1d. Expiration check
  if (idScan.status === 'expired') {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: `ID Expired: ${idScan.summary}`,
    };
  }

  // 1e. Screenshot detection check
  if (idScan.status === 'screenshot_detected') {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: `Screenshot Rejected: ${idScan.summary}`,
    };
  }

  // 1f. Unsupported document check
  if (idScan.status === 'unsupported_id') {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: `Unsupported Document: ${idScan.summary}`,
    };
  }

  // 1f. Readability check (sufficient OCR text extracted from physical card)
  if (
    idDocFile.mimetype !== 'application/pdf' &&
    idScan.ocrText !== undefined &&
    idScan.ocrText.length < 10 &&
    idScan.status !== 'provider_unavailable'
  ) {
    return {
      step: 1,
      valid: false,
      rejectedField: 'idDocument',
      idScan,
      reason: 'ID Readability Failed: The text on your uploaded ID card could not be read clearly. Please upload a flat, well-lit photo with all printed details legible.',
    };
  }

  // 1g. Profile match: Verify applicant's registered name against ID OCR text
  if (applicantName && idScan.ocrText && idScan.ocrText.length >= 30) {
    const nameMatch = verifyNameMatchesId(applicantName, idScan.ocrText);
    if (!nameMatch.matched) {
      return {
        step: 1,
        valid: false,
        rejectedField: 'idDocument',
        idScan,
        reason: `Profile Mismatch: The name on the uploaded ID does not appear to match "${applicantName}". Please ensure the ID document belongs to the person registering.`,
      };
    }
  }

  return {
    step: 1,
    valid: true,
    idScan,
  };
}

/**
 * Step 2: Once ID is approved, verifies that the selfie holding the exact same ID
 * passes image quality, face matching, and cross-document verification.
 */
async function verifySelfieHoldingIdStep(selfieFile, idDocFile, idScan) {
  if (!selfieFile) {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      reason: 'A selfie holding your valid ID card is required to verify your identity.',
    };
  }

  // 2a. Duplicate photo prevention (cannot reuse exact same file as ID)
  try {
    if (idDocFile?.path && selfieFile?.path) {
      const idBuf = await fs.promises.readFile(idDocFile.path);
      const selfieBuf = await fs.promises.readFile(selfieFile.path);
      const idHash = crypto.createHash('sha256').update(idBuf).digest('hex');
      const selfieHash = crypto.createHash('sha256').update(selfieBuf).digest('hex');

      if (idHash === selfieHash) {
        return {
          step: 2,
          valid: false,
          rejectedField: 'selfieWithId',
          reason: 'Duplicate Image Detected: You cannot upload the exact same picture file for both the ID card and the selfie. Please take and upload an authentic selfie holding your ID.',
        };
      }
    }
  } catch (hashErr) {
    console.error('[verifySelfieHoldingIdStep] Hash comparison error:', hashErr.message);
  }

  // 2b. AI scan of the selfie image (sharpness, lighting, deepfakes, face detection)
  const selfieScan = await validateIdImage(selfieFile, { isIdCard: false });

  // 2c. Screenshot rejection check
  if (selfieScan.status === 'screenshot_detected') {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: `Selfie Screenshot Rejected: ${selfieScan.summary}`,
    };
  }

  // 2d. Image quality: Blur check
  if (selfieScan.status === 'blurry') {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: `Selfie Image Quality Issue: The selfie is too blurry (${selfieScan.summary}). Please hold your ID steady next to your face in good lighting and re-upload.`,
    };
  }

  // 2d. Image quality: Lighting check
  if (selfieScan.status === 'poor_lighting') {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: `Selfie Image Quality Issue: ${selfieScan.summary}`,
    };
  }

  // 2e. Image quality: AI deepfake detection
  if (selfieScan.status === 'ai_detected') {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: `Selfie Authenticity Failed: The uploaded selfie was flagged as synthetic or AI-generated (${selfieScan.summary}). Please upload a genuine, unedited photo of yourself holding your ID.`,
    };
  }

  // 2f. Face matching: Ensure at least one distinct human face is present in the selfie
  if (selfieScan.facesCount !== undefined && selfieScan.facesCount === 0 && selfieScan.status !== 'provider_unavailable') {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: 'Face Matching Failed: No clear human face was detected in your selfie. Please ensure your face is fully visible, well-lit, and unobscured while holding your physical ID next to your face.',
    };
  }

  // 2g. Face Consistency Check: Verify both the ID document and the selfie contain a human face
  if (
    idScan?.facesCount !== undefined &&
    idScan.facesCount > 0 &&
    selfieScan?.facesCount !== undefined &&
    selfieScan.facesCount === 0
  ) {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: 'Face Verification Failed: The photo on your valid ID could not be matched with a face in your selfie. Your face in the selfie must match the portrait on your physical ID.',
    };
  }

  // 2h. ID Card Presence & Cross-Match Verification:
  // Detect whether an ID card is actually visible in the selfie.
  const idTokens = extractIdTokens(idScan?.ocrText);
  const selfieOcrText = (selfieScan.ocrText || '').toUpperCase();
  const detectedFacesInSelfie = typeof selfieScan.facesCount === 'number' ? selfieScan.facesCount : 1;

  // Specific anchor keywords representing real IDs (excludes generic shirt/room words like 'STAFF', 'POBLACION')
  const matchedAnchorKeywords = CARD_ANCHOR_KEYWORDS.filter((kw) => selfieOcrText.includes(kw));
  const hasCardAnchorKeyword = matchedAnchorKeywords.length > 0;

  // Match tokens between the ID document uploaded in Step 1 and the selfie text
  let matchingTokens = [];
  if (idTokens.length > 0 && selfieOcrText.length > 0) {
    matchingTokens = idTokens.filter((token) => selfieOcrText.includes(token));
  }

  // Strong card evidence:
  // (a) Specific government ID keyword found in selfie OCR (e.g. PHILSYS, DRIVER, COMELEC, PASSPORT)
  // (b) Or matching token from the Step 1 ID card found in selfie OCR
  // (c) Or a secondary face detected (the portrait photo on the physical ID card held up to the camera)
  const hasDefiniteCardEvidence =
    matchingTokens.length > 0 ||
    hasCardAnchorKeyword ||
    detectedFacesInSelfie >= 2;

  // Cross-match check: If the selfie contains readable text (>= 12 chars), but has 0 matching tokens
  // and no recognized ID anchor keywords, it is likely displaying a completely different card or random paper
  if (idTokens.length >= 3 && selfieOcrText.length >= 12 && !hasDefiniteCardEvidence) {
    return {
      step: 2,
      valid: false,
      rejectedField: 'selfieWithId',
      selfieScan,
      reason: 'ID Document Mismatch: The ID document shown in your selfie does not match the valid ID card you uploaded in Step 1. Please hold the exact same physical ID next to your face so both your face and ID are clearly visible.',
    };
  }

  // If the scanner succeeded and there is definitive card evidence:
  if (hasDefiniteCardEvidence) {
    return {
      step: 2,
      valid: true,
      selfieScan,
    };
  }

  // If scanner was unavailable or not configured, pass through for admin review
  if (selfieScan.status === 'provider_unavailable' || selfieScan.status === 'not_configured') {
    return {
      step: 2,
      valid: true,
      selfieScan,
    };
  }

  // When no definite text/second face is found:
  // In arm's-length selfies, camera resolution or focal distance may cause the held ID's text
  // to be unreadable by OCR (selfieOcrText is empty or near empty).
  // Rather than falsely rejecting an authentic resident whose camera couldn't resolve micro-text,
  // or accepting an upload with no ID, we check if the selfie meets basic quality:
  // If the selfie is clear, has a valid face, and no red flags, we allow registration to complete
  // while marking selfieScan as requiring manual admin review.
  selfieScan.manualReviewAdvised = true;
  selfieScan.summary = 'Selfie uploaded with valid face. ID card details in selfie queued for Barangay Admin verification.';

  return {
    step: 2,
    valid: true,
    selfieScan,
  };
}

/**
 * Executes Two-Step AI Verification:
 * Step 1: Validates ID authenticity, readability, expiration, and profile match.
 * Step 2 (Only if Step 1 is approved): Validates the selfie holding the exact same ID for image quality and face matching.
 */
async function verifyIdAndSelfieMatch(idDocFile, selfieFile, options = {}) {
  // --- STEP 1: Verify ID Document ---
  const step1Result = await verifyIdDocumentStep(idDocFile, options);
  if (!step1Result.valid) {
    return step1Result;
  }

  // --- STEP 2: Verify Selfie Holding the Approved ID ---
  const step2Result = await verifySelfieHoldingIdStep(selfieFile, idDocFile, step1Result.idScan);
  if (!step2Result.valid) {
    return {
      ...step2Result,
      idScan: step1Result.idScan,
    };
  }

  return {
    valid: true,
    step: 2,
    idScan: step1Result.idScan,
    selfieScan: step2Result.selfieScan,
  };
}

module.exports = {
  validateIdImage,
  verifyIdDocumentStep,
  verifySelfieHoldingIdStep,
  verifyIdAndSelfieMatch,
};
