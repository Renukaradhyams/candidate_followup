import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE_KB = 1000;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_KB * 1024; // 1024000 bytes
const TARGET_COMPRESSED_SIZE_MB = 0.94; // ~960 KB (safe buffer under 1000KB)

/**
 * Fallback Canvas image compressor.
 * Guarantees high-resolution camera photos (e.g. 15MB-30MB 4K phone camera photos)
 * are downscaled safely without triggering WebWorker / memory crash on mobile devices.
 */
async function compressImageViaCanvas(file: File, maxDimension = 1280, targetSizeBytes = 960 * 1024): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file for optimization.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into canvas element.'));
      img.onload = async () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(file);
          }
          
          // White background for transparent PNG conversion to JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.82;
          let blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));

          // Iteratively step down quality if file size is still over target
          while (blob && blob.size > targetSizeBytes && quality > 0.3) {
            quality -= 0.15;
            blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
          }

          if (!blob) return resolve(file);

          const rawName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "photo";
          const compressedFile = new File([blob], `${rawName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
          resolve(compressedFile);
        } catch (err) {
          resolve(file);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes a file before upload.
 * Images will be compressed heavily to fall strictly under 1000 KB.
 * Other files (PDF, DOCX) will be checked against the 1000 KB limit.
 */
export async function optimizeFile(file: File, fileTypeLabel: string): Promise<File> {
  // If it is an image, we try to compress it heavily under 1000 KB
  if (file.type.startsWith('image/')) {
    try {
      const options = {
        maxSizeMB: TARGET_COMPRESSED_SIZE_MB,
        maxWidthOrHeight: 1400,
        useWebWorker: false, // Prevents iOS Safari & Android Chrome WebWorker context crashes
        initialQuality: 0.8,
        alwaysKeepResolution: false
      };

      let compressedFile = await imageCompression(file, options);

      // Safety check: if it is STILL over 1000 KB, run native canvas downscaling fallback
      if (compressedFile.size > MAX_FILE_SIZE_BYTES) {
        compressedFile = await compressImageViaCanvas(file, 1280, 950 * 1024);
      }

      if (compressedFile.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`${fileTypeLabel} cannot be compressed below 1000 KB. Please choose a smaller image.`);
      }

      return compressedFile;
    } catch (error: any) {
      if (error.message && error.message.includes('1000 KB')) {
        throw error;
      }
      
      // If primary library compression fails or throws, fallback to canvas compressor
      try {
        const fallbackFile = await compressImageViaCanvas(file, 1280, 950 * 1024);
        if (fallbackFile.size <= MAX_FILE_SIZE_BYTES) {
          return fallbackFile;
        }
      } catch (fallbackError) {}

      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`${fileTypeLabel} optimization failed and original file is over 1000 KB (${(file.size / 1024).toFixed(1)} KB). Please upload a smaller file.`);
      }
      return file;
    }
  }

  // If it's a PDF, DOCX, or anything non-image, check strictly against 1000 KB limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${fileTypeLabel} is too large (${(file.size / 1024).toFixed(1)} KB). Maximum allowed file size is 1000 KB.`);
  }

  return file;
}
