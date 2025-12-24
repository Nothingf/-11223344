import React, { useState } from 'react';
import { Upload, Hand, GripHorizontal, Maximize, RotateCcw, Image as ImageIcon, X, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { AppMode, GestureType, PhotoData } from '../types';

interface UIOverlayProps {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (id: string) => void;
  onSaveGallery: () => void;
  photos: PhotoData[];
  mode: AppMode;
  currentGesture: GestureType;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ onUpload, onDeletePhoto, onSaveGallery, photos, mode, currentGesture }) => {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
  // Default to open only on desktop (width >= 768px), closed/minimized on mobile
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  
  // Default to open only on desktop, closed/minimized on mobile
  const [isControlsOpen, setIsControlsOpen] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const handleSaveClick = () => {
      onSaveGallery();
      // Optional Visual Feedback
      const btn = document.getElementById('save-btn-icon');
      if (btn) {
          btn.classList.add('text-green-400');
          setTimeout(() => btn.classList.remove('text-green-400'), 1000);
      }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10">
      
      {/* Header */}
      <header className="flex justify-between items-start pointer-events-auto w-full">
        <div className="text-left pointer-events-none select-none mt-2 ml-2 md:mt-0 md:ml-0">
          {/* Responsive Text Size: smaller on mobile to avoid blocking the tree */}
          <h1 className="text-2xl md:text-5xl text-yellow-500 font-bold tracking-widest drop-shadow-[0_0_15px_rgba(212,175,55,0.8)] leading-tight opacity-80 md:opacity-100">
            Merry<br />Christmas
          </h1>
        </div>
        
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
           {isControlsOpen ? (
              <div className="flex gap-2 items-start animate-in fade-in slide-in-from-top-4 duration-300">
                 {/* Gallery Button */}
                 <button 
                   onClick={() => setIsGalleryOpen(true)}
                   className="flex items-center gap-2 bg-white/5 border border-yellow-500/30 backdrop-blur-md px-3 py-2 md:px-4 rounded-full transition-all hover:bg-yellow-500/20 hover:border-yellow-500"
                 >
                   <ImageIcon size={16} className="text-yellow-500" />
                   <span className="text-yellow-100 text-xs md:text-sm font-light hidden sm:inline">
                      {photos.length} 照片
                   </span>
                   <span className="text-yellow-100 text-xs md:text-sm font-light sm:hidden">
                      {photos.length}
                   </span>
                 </button>

                 {/* Upload Button */}
                 <label className="cursor-pointer group flex items-center gap-2 bg-yellow-600/20 border border-yellow-500/50 backdrop-blur-md px-3 py-2 md:px-4 rounded-full transition-all hover:bg-yellow-600/40 hover:border-yellow-400">
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    onChange={onUpload}
                  />
                  <Upload size={16} className="text-yellow-400" />
                  <span className="text-yellow-100 text-xs md:text-sm font-light hidden sm:inline">上传</span>
                </label>

                {/* Minimize Toggle (Up Arrow to fold up) */}
                <button 
                  onClick={() => setIsControlsOpen(false)}
                  className="bg-black/30 backdrop-blur-md p-2 rounded-full border border-white/10 hover:bg-white/10 text-white/70 transition-colors"
                  title="最小化"
                >
                  <ChevronUp size={18} />
                </button>
              </div>
           ) : (
              // Expand Toggle (Down Arrow to unfold down)
              <button 
                onClick={() => setIsControlsOpen(true)}
                className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-yellow-600/50 hover:bg-yellow-600/20 text-yellow-500 transition-all shadow-lg hover:shadow-yellow-500/20"
                title="展开菜单"
              >
                <ChevronDown size={24} />
              </button>
           )}
        </div>
      </header>

      {/* Gallery Modal */}
      {isGalleryOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 pointer-events-auto">
          <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl m-4">
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                  <h2 className="text-xl text-yellow-500 font-serif">照片库 ({photos.length})</h2>
                  
                  {/* Save Button */}
                  <button 
                    onClick={handleSaveClick}
                    className="flex items-center gap-1.5 bg-yellow-600/20 border border-yellow-600/50 hover:bg-yellow-600/40 text-yellow-100 text-xs px-3 py-1.5 rounded-full transition-all"
                    title="保存照片到本地"
                  >
                    <Save size={14} id="save-btn-icon" className="transition-colors duration-300" />
                    <span>保存</span>
                  </button>
              </div>

              <button onClick={() => setIsGalleryOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-4">
              {photos.length === 0 && (
                <div className="col-span-full text-center text-white/30 py-10 italic">
                  暂无照片，请点击右上角上传
                </div>
              )}
              {photos.map(photo => (
                <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5">
                  <img src={photo.url} alt="User Upload" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => onDeletePhoto(photo.id)}
                    className="absolute top-1 right-1 bg-red-500/80 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer / Instructions */}
      <div className="flex justify-between items-end">
        
        <div className="pointer-events-auto relative">
          {isInstructionsOpen ? (
            <div className="bg-black/40 backdrop-blur-md p-3 md:p-4 rounded-xl border-l-2 border-yellow-600 w-fit transition-all duration-300 origin-bottom-left whitespace-nowrap">
              <div className="flex justify-between items-center gap-4 mb-2 md:mb-3">
                 <h3 className="text-yellow-500 font-serif text-xs md:text-sm tracking-widest uppercase">手势控制</h3>
                 <button 
                   onClick={() => setIsInstructionsOpen(false)} 
                   className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                 >
                   <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                 </button>
              </div>
              
              <div className="flex flex-col gap-2 md:gap-3 text-xs md:text-sm text-gray-300">
                <div className={`flex items-center gap-2 md:gap-3 ${currentGesture === 'FIST' ? 'text-green-400 font-bold' : ''}`}>
                  <GripHorizontal className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                  <span className="leading-tight">握拳：组合圣诞树</span>
                </div>
                <div className={`flex items-center gap-2 md:gap-3 ${currentGesture === 'OPEN_PALM' ? 'text-green-400 font-bold' : ''}`}>
                  <Hand className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                  <span className="leading-tight">张开手掌：散开</span>
                </div>
                <div className={`flex items-center gap-2 md:gap-3 ${currentGesture === 'PINCH' ? 'text-green-400 font-bold' : ''}`}>
                  <Maximize className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                  <span className="leading-tight">双指捏合：抓取照片</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <RotateCcw className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                  <span className="leading-tight">移动手部：旋转视角</span>
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setIsInstructionsOpen(true)}
              className="bg-black/40 backdrop-blur-md p-2 md:p-3 rounded-full border border-yellow-600/50 hover:bg-yellow-600/20 text-yellow-500 transition-all shadow-lg hover:shadow-yellow-500/20"
              title="显示手势说明"
            >
              <ChevronUp size={24} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default UIOverlay;