const fs = require('fs');
const path = require('path');
const { init } = require('@heyputer/puter.js/src/init.cjs');

let puterClient = null;
let hostingSubdomain = process.env.PUTER_HOSTING_SUBDOMAIN || null;
let hostingInitialized = false;

function getPuterClient() {
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token) return null;
  if (!puterClient) {
    try {
      puterClient = init(token);
    } catch (err) {
      console.error('[PUTER] Failed to initialize Puter client:', err.message);
      return null;
    }
  }
  return puterClient;
}

function isPuterConfigured() {
  return !!process.env.PUTER_AUTH_TOKEN;
}

/**
 * Ensures a public hosting subdomain is mapped to the 'public' directory
 */
async function ensureHostingSubdomain(puter) {
  if (hostingSubdomain && hostingInitialized) return hostingSubdomain;

  try {
    // If user provided a specific subdomain in .env, verify or create it
    if (process.env.PUTER_HOSTING_SUBDOMAIN) {
      hostingSubdomain = process.env.PUTER_HOSTING_SUBDOMAIN.trim();
      try {
        await puter.fs.mkdir('public', { createMissingParents: true });
        await puter.hosting.create(hostingSubdomain, 'public');
      } catch (e) {
        // Site might already exist, which is fine
      }
      hostingInitialized = true;
      return hostingSubdomain;
    }

    // Otherwise find existing hosted site or create a new unique one
    const sites = await puter.hosting.list();
    if (Array.isArray(sites) && sites.length > 0) {
      hostingSubdomain = sites[0].subdomain;
      hostingInitialized = true;
      return hostingSubdomain;
    }

    // Create a new hosted public directory
    const randomSubdomain = `brgy-poblacion-${Date.now().toString(36)}`;
    await puter.fs.mkdir('public', { createMissingParents: true });
    const site = await puter.hosting.create(randomSubdomain, 'public');
    hostingSubdomain = site.subdomain || randomSubdomain;
    hostingInitialized = true;
    return hostingSubdomain;
  } catch (err) {
    console.warn('[PUTER HOSTING] Could not initialize hosting subdomain:', err.message);
    return null;
  }
}

/**
 * Uploads a file buffer or disk file to Puter cloud storage.
 * If public hosting is enabled, returns the permanent public URL (https://<subdomain>.puter.site/...).
 *
 * @param {object|string} file - Multer file object or local file path
 * @param {string} folder - Target folder inside public storage
 * @returns {Promise<string|null>} Public URL or null if failed / unconfigured
 */
async function uploadToPuter(file, folder = 'uploads') {
  const puter = getPuterClient();
  if (!puter) return null;

  const filePath = typeof file === 'string' ? file : file?.path;
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const ext = path.extname(filePath) || '.jpg';
    const baseName = path.basename(filePath, ext);
    const uniqueFileName = `${baseName}-${Date.now()}${ext}`;
    const destinationPath = `public/${folder.replace(/^\//, '')}/${uniqueFileName}`;

    const buffer = await fs.promises.readFile(filePath);
    await puter.fs.write(destinationPath, buffer, {
      overwrite: true,
      createMissingParents: true,
    });

    const subdomain = await ensureHostingSubdomain(puter);
    if (subdomain) {
      const publicUrl = `https://${subdomain}.puter.site/${folder.replace(/^\//, '')}/${uniqueFileName}`;
      return publicUrl;
    }

    // Fallback if hosting could not be provisioned
    return `puter://${destinationPath}`;
  } catch (err) {
    console.error(`[PUTER] Upload to "${folder}" failed:`, err.message || err);
    return null;
  }
}

module.exports = {
  getPuterClient,
  isPuterConfigured,
  uploadToPuter,
};
