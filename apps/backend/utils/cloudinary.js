const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

const { isPuterConfigured, uploadToPuter } = require('./puterStorage');

/**
 * Uploads a file (Multer file object or file path) to Cloud Storage (Puter.js or Cloudinary)
 * @param {object|string} file - Multer file object or local file path
 * @param {string} folder - Target directory
 * @returns {Promise<string|null>} Secure CDN URL or null if failed / not configured
 */
async function uploadToCloudinary(file, folder = 'barangay/uploads') {
  // If Puter.js is configured via PUTER_AUTH_TOKEN, upload to Puter storage
  if (isPuterConfigured()) {
    const puterUrl = await uploadToPuter(file, folder);
    if (puterUrl) return puterUrl;
  }

  // Fallback to Cloudinary if configured
  if (!isCloudinaryConfigured()) return null;

  const filePath = typeof file === 'string' ? file : file?.path;
  if (!filePath) return null;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });
    return result.secure_url;
  } catch (err) {
    console.error(`[CLOUDINARY] Upload to "${folder}" failed:`, err.message || err);
    return null;
  }
}

async function deleteLocalUpload(file) {
  const filePath = typeof file === 'string' ? file : file?.path;
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteLocalUpload,
};
