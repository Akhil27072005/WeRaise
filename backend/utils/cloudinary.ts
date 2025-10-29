import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary
 * @param fileBuffer - The file buffer from multer
 * @param folder - Optional folder name in Cloudinary
 * @returns Promise<string> - The secure URL of the uploaded image
 */
export const uploadFile = async (
  fileBuffer: Buffer,
  folder: string = 'campaign-images'
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Convert buffer to stream
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        transformation: [
          { width: 1200, height: 800, crop: 'fill', quality: 'auto' },
          { fetch_format: 'auto' }
        ],
        public_id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Failed to upload image: ${error.message}`));
        } else if (result) {
          console.log('Image uploaded successfully:', result.secure_url);
          resolve(result.secure_url);
        } else {
          reject(new Error('No result from Cloudinary upload'));
        }
      }
    );

    // Create readable stream from buffer
    const readable = new Readable();
    readable.push(fileBuffer);
    readable.push(null);
    
    // Pipe the buffer to Cloudinary
    readable.pipe(stream);
  });
};

/**
 * Delete an image from Cloudinary using its public ID
 * @param publicId - The public ID of the image to delete
 * @returns Promise<boolean> - True if deletion was successful
 */
export const deleteFile = async (publicId: string): Promise<boolean> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    return false;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param url - The Cloudinary URL
 * @returns string | null - The public ID or null if not found
 */
export const extractPublicId = (url: string): string | null => {
  const match = url.match(/\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp)$/i);
  return match ? match[1] : null;
};

export default cloudinary;
