const ImageKit = require('imagekit');

class ImageKitService {
  constructor() {
    this.imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });
  }

  // Upload image to ImageKit
  async uploadImage(fileBuffer, fileName, folder = 'fitness-ai-chat') {
    try {
      console.log('📤 Uploading image to ImageKit:', fileName);
      
      const uploadResponse = await this.imagekit.upload({
        file: fileBuffer,
        fileName: fileName,
        folder: folder,
        useUniqueFileName: true,
        tags: ['fitness-ai', 'chat-images'],
        responseFields: ['url', 'fileId', 'name']
      });

      console.log('✅ Image uploaded successfully:', uploadResponse.url);
      
      return {
        success: true,
        url: uploadResponse.url,
        fileId: uploadResponse.fileId,
        fileName: uploadResponse.name
      };
    } catch (error) {
      console.error('❌ ImageKit upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload image from file path
  async uploadImageFromPath(filePath, fileName, folder = 'fitness-ai-chat') {
    try {
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      
      return await this.uploadImage(fileBuffer, fileName, folder);
    } catch (error) {
      console.error('❌ Error reading file for upload:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete image from ImageKit
  async deleteImage(fileId) {
    try {
      await this.imagekit.deleteFile(fileId);
      console.log('✅ Image deleted successfully:', fileId);
      return { success: true };
    } catch (error) {
      console.error('❌ ImageKit delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get image info
  async getImageInfo(fileId) {
    try {
      const imageInfo = await this.imagekit.getFileDetails(fileId);
      return {
        success: true,
        info: imageInfo
      };
    } catch (error) {
      console.error('❌ ImageKit get info error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ImageKitService(); 