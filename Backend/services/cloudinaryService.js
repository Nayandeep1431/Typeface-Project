const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

class CloudinaryService {
  constructor() {
    this.validateConfig();
  }

  validateConfig() {
    const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing Cloudinary configuration: ${missingVars.join(', ')}`);
    }
  }

  /**
   * Upload file buffer to Cloudinary
   * @param {Buffer} fileBuffer - File buffer to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Upload result
   */
  async uploadFile(fileBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'auto',
        folder: 'receipts',
        quality: 'auto:good',
        format: 'auto',
        ...options
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(new Error(`File upload failed: ${error.message}`));
          } else {
            console.log('✅ File uploaded to Cloudinary:', result.public_id);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              format: result.format,
              bytes: result.bytes,
              width: result.width,
              height: result.height
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Public ID of the file to delete
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteFile(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('🗑️ File deleted from Cloudinary:', publicId);
      return result;
    } catch (error) {
      console.error('❌ Cloudinary deletion error:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  /**
   * Generate optimized URL for display
   * @param {string} publicId - Public ID of the file
   * @param {Object} transformations - Transformation options
   * @returns {string} - Optimized URL
   */
  getOptimizedUrl(publicId, transformations = {}) {
    const defaultTransformations = {
      quality: 'auto:good',
      fetch_format: 'auto',
      ...transformations
    };

    return cloudinary.url(publicId, defaultTransformations);
  }

  /**
   * Generate thumbnail URL
   * @param {string} publicId - Public ID of the file
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {string} - Thumbnail URL
   */
  getThumbnailUrl(publicId, width = 200, height = 200) {
    return this.getOptimizedUrl(publicId, {
      width,
      height,
      crop: 'fill',
      gravity: 'center'
    });
  }
}

module.exports = new CloudinaryService();
