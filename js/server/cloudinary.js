// cloudinary.js

import cloudinary from 'cloudinary';

export function configureCloudinary() {
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
  });
}

export async function uploadToCloudinary(filePath) {
  try {
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: 'snap3d/uploads',
    });
    return uploadResult.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}