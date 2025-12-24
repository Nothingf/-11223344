import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import HandTracker from './components/HandTracker';
import Experience from './components/Experience';
import UIOverlay from './components/UIOverlay';
import { AppMode, GestureType, HandState, PhotoData } from './types';
import { CONFIG } from './constants';
import { processImageFile, loadFromStorage, saveToStorage } from './services/storage';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('ASSEMBLED');
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [handState, setHandState] = useState<HandState>({
    gesture: 'NONE',
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    isPresent: false,
  });
  const [focusId, setFocusId] = useState<string | null>(null);
  
  // Track which photo to show next (Sequential order)
  const nextPhotoIndex = useRef(0);

  // Load photos from storage on mount
  useEffect(() => {
    const savedPhotos = loadFromStorage();
    if (savedPhotos && savedPhotos.length > 0) {
        setPhotos(savedPhotos);
    }
  }, []);

  // Improved Position Generator: Uses Index to ensure even distribution (Golden Spiral)
  const generateFramePosition = useCallback((index: number, totalExisting: number) => {
    // Effective index for calculation to avoid collisions with existing ones
    const i = totalExisting + index;

    // --- 1. ASSEMBLED POSITION (Tree Surface) ---
    // Goal: Even distribution in the middle 50% of the tree height.
    // Algorithm: Golden Spiral on a Cone.
    
    const minHPercent = 0.25;
    const maxHPercent = 0.75;
    const heightRange = maxHPercent - minHPercent;

    // Distribute height linearly based on index (modulo to cycle if many photos)
    // Adding a slight random offset to 'i' prevents perfect lines but maintains spacing
    const heightCycle = 15; // Cycle every 15 photos from bottom to top
    const normalizedH = minHPercent + ((i % heightCycle) / heightCycle) * heightRange;
    // Add tiny random jitter to height (±2%)
    const finalH = (normalizedH + (Math.random() * 0.04 - 0.02)) * CONFIG.TREE_HEIGHT;
    
    // Radius at this height
    const rMaxAtH = (CONFIG.TREE_RADIUS_BOTTOM * (CONFIG.TREE_HEIGHT - finalH)) / CONFIG.TREE_HEIGHT;
    // Place on surface (0.9 to 1.0 of max radius)
    const rTree = rMaxAtH * (0.9 + Math.random() * 0.1);

    // Angle: Golden Angle (137.5 deg) * index
    const goldenAngle = 2.39996; // radians
    const thetaTree = i * goldenAngle;

    const tx = Math.cos(thetaTree) * rTree;
    const tz = Math.sin(thetaTree) * rTree;
    const ty = finalH - CONFIG.TREE_HEIGHT / 2;

    // --- 2. DISPERSED POSITION (Cloud/Nebula) ---
    // Goal: Even distribution, no overlap, fully on screen.
    // Algorithm: Fibonacci Sphere (restricted to a band).

    // Radius: 6.0 to 9.0 (Wide enough to not overlap, close enough to be on screen)
    // We vary radius slightly based on index to create depth layers
    const rScatter = 6.0 + (i % 3) * 1.5 + Math.random();

    // Vertical Spread (Phi):
    // Standard Fibonacci distributes from -1 to 1. We restrict to -0.4 to 0.4 (Middle Band).
    // This ensures they don't go off the top/bottom of the screen.
    const verticalBand = 0.8; // Use middle 80% of the sphere height, effectively
    const yRatio = 1 - (i / (heightCycle + 1)) * 2; // Simple distribution basis
    // Wrap random value within the safe vertical band [-0.35, 0.35]
    // We use a randomized mapped index to ensure they aren't linear in the cloud relative to the tree
    const rndY = ((i * 13) % 20) / 20; // Pseudo-random 0-1
    const safeY = (rndY - 0.5) * verticalBand; // -0.4 to 0.4
    
    const phi = Math.acos(safeY); // Convert height to angle
    const thetaScatter = i * goldenAngle; // Golden angle for even spacing

    const sx = rScatter * Math.sin(phi) * Math.cos(thetaScatter);
    const sy = rScatter * Math.cos(phi);
    const sz = rScatter * Math.sin(phi) * Math.sin(thetaScatter);

    return {
      treePosition: [tx, ty, tz] as [number, number, number],
      scatterPosition: [sx, sy, sz] as [number, number, number]
    };
  }, []);

  // Handle Photo Uploads - Now Async to handle compression
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const currentCount = photos.length;
      
      const newPhotos: PhotoData[] = [];

      // Process sequentially to maintain index order for positions
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const base64Url = await processImageFile(file);
          const photoData: PhotoData = {
            id: uuidv4(),
            url: base64Url,
            aspectRatio: 1, // You could calculate this inside processImageFile if needed
            ...generateFramePosition(i, currentCount)
          };
          newPhotos.push(photoData);
        } catch (err) {
          console.error("Error processing file:", file.name, err);
        }
      }

      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleDeletePhoto = useCallback((id: string) => {
    setPhotos(prev => {
        const newPhotos = prev.filter(p => p.id !== id);
        // Automatically save on delete to keep state consistent
        saveToStorage(newPhotos);
        return newPhotos;
    });
    if (focusId === id) {
        setMode('DISPERSED');
        setFocusId(null);
    }
  }, [focusId]);

  const handleSaveGallery = useCallback(() => {
      const success = saveToStorage(photos);
      if (success) {
          // Optional: Add a toast notification here
          console.log("Gallery Saved!");
      }
  }, [photos]);

  // State Machine Logic driven by Hand Gestures
  useEffect(() => {
    if (!handState.isPresent) return;

    if (handState.gesture === 'FIST' && mode !== 'ASSEMBLED') {
      setMode('ASSEMBLED');
      setFocusId(null);
    } else if (handState.gesture === 'OPEN_PALM') {
       if (mode === 'ASSEMBLED') {
         setMode('DISPERSED');
       } else if (mode === 'FOCUS') {
         // Smoothly return to cloud
         setMode('DISPERSED');
         setFocusId(null);
       }
    } else if (handState.gesture === 'PINCH' && mode === 'DISPERSED') {
      // Pick next photo in sequence if not already focused
      if (!focusId && photos.length > 0) {
        setMode('FOCUS');
        
        const index = nextPhotoIndex.current % photos.length;
        const photo = photos[index];
        setFocusId(photo.id);
        
        // Increment for next time
        nextPhotoIndex.current += 1;
      }
    }

  }, [handState.gesture, handState.isPresent, mode, photos, focusId]);

  const onHandUpdate = useCallback((newState: HandState) => {
    setHandState(newState);
  }, []);

  return (
    <div className="w-full h-screen relative bg-black overflow-hidden">
      <Experience 
        mode={mode} 
        photos={photos} 
        rotationOffset={handState.rotation} 
        focusId={focusId}
      />
      
      <UIOverlay 
        onUpload={handleUpload} 
        onDeletePhoto={handleDeletePhoto}
        onSaveGallery={handleSaveGallery}
        mode={mode} 
        currentGesture={handState.gesture}
        photos={photos} 
      />

      <HandTracker onHandUpdate={onHandUpdate} />
    </div>
  );
};

export default App;