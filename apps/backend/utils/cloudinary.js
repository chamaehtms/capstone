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

/**
 * Uploads a file (Multer file object or file path) to Cloudinary
 * @param {object|string} file - Multer file object or local file path
 * @param {string} folder - Target Cloudinary directory
 * @returns {Promise<string|null>} Secure CDN URL or null if failed / not configured
 */
async function uploadToCloudinary(file, folder = 'barangay/uploads') {
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
