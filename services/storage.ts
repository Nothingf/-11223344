import { PhotoData } from '../types';

const STORAGE_KEY = 'lumiere_noel_photos_v1';

// Max dimension for stored images to save LocalStorage space
const MAX_IMAGE_DIMENSION = 800; 
const JPEG_QUALITY = 0.7;

/**
 * Compresses and converts an image file to a Base64 string.
 */
export const processImageFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if too large
        if (width > height) {
          if (width > MAX_IMAGE_DIMENSION) {
            height *= MAX_IMAGE_DIMENSION / width;
            width = MAX_IMAGE_DIMENSION;
          }
        } else {
          if (height > MAX_IMAGE_DIMENSION) {
            width *= MAX_IMAGE_DIMENSION / height;
            height = MAX_IMAGE_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as compressed JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const saveToStorage = (photos: PhotoData[]) => {
  try {
    const json = JSON.stringify(photos);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error("Storage failed (likely quota exceeded):", e);
    alert("保存失败：照片总大小超过了浏览器存储限制，请尝试删除一些照片或上传较小的图片。");
    return false;
  }
};

export const loadFromStorage = (): PhotoData[] | null => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to load photos:", e);
    return null;
  }
};