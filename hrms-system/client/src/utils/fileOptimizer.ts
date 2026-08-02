import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE_MB = 0.48; // 480 KB (leaves a bit of buffer under 500KB)

/**
 * Optimizes a file before upload.
 * Images will be compressed heavily to fall under 500KB.
 * Other files (PDF, DOCX) will be checked against the 500KB limit.
 */
export async function optimizeFile(file: File, fileTypeLabel: string): Promise<File> {
  // If it is an image, we try to compress it heavily
  if (file.type.startsWith('image/')) {
    try {
      const options = {
        maxSizeMB: MAX_FILE_SIZE_MB,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8,
        alwaysKeepResolution: false
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Safety check: is it STILL over 500KB? (Very rare for browser-image-compression)
      if (compressedFile.size > 512 * 1024) {
        throw new Error(`${fileTypeLabel} cannot be compressed below 500 KB without severe quality loss. Please upload a smaller file.`);
      }
      
      return compressedFile;
    } catch (error: any) {
      if (error.message && error.message.includes('500 KB')) {
        throw error; // Propagate our custom size error
      }
      // If compression fails for other reasons, we fallback to original but size check applies
      if (file.size > 512 * 1024) {
        throw new Error(`${fileTypeLabel} optimization failed and original is over 500 KB. Please upload a smaller file.`);
      }
      return file;
    }
  }

  // If it's a PDF, DOCX, or anything else, we just strictly validate size since we don't have Ghostscript/LibreOffice on client
  if (file.size > 512 * 1024) {
    throw new Error(`${fileTypeLabel} is too large (${(file.size / 1024).toFixed(1)} KB) and cannot be automatically compressed without quality loss. Please upload a file smaller than 500 KB.`);
  }

  return file;
}
