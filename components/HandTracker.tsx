import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { detectGesture, calculateHandRotation } from '../services/gestureRecognition';
import { HandState, GestureType } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface HandTrackerProps {
  onHandUpdate: (state: HandState) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default to minimized on mobile (width < 768px), maximized on desktop
  const [isMinimized, setIsMinimized] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // --- Stability Refs ---
  const stableGestureRef = useRef<GestureType>('NONE');
  const lastRawGestureRef = useRef<GestureType>('NONE');
  const gestureConsistencyCount = useRef(0);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        startWebcam();
      } catch (err) {
        console.error("MediaPipe Init Error:", err);
        setError("Failed to load AI models.");
        setLoading(false);
      }
    };

    const startWebcam = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: 640,
              height: 480,
              facingMode: 'user'
            },
            audio: false,
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
          }
          setLoading(false);
        } catch (err) {
          console.error("Webcam Error:", err);
          setError("Camera permission denied.");
          setLoading(false);
        }
      }
    };

    let lastVideoTime = -1;
    let lastPredictionTime = 0;
    // Increased from 10fps (100ms) to 20fps (50ms) for smoother tracking
    const PREDICTION_INTERVAL = 50; 

    const predictWebcam = () => {
      if (videoRef.current && handLandmarker) {
        const now = performance.now();
        
        if (now - lastPredictionTime >= PREDICTION_INTERVAL) {
            if (videoRef.current.currentTime !== lastVideoTime) {
              lastVideoTime = videoRef.current.currentTime;
              lastPredictionTime = now;
              
              const detections = handLandmarker.detectForVideo(videoRef.current, now);

              if (detections.landmarks && detections.landmarks.length > 0) {
                const landmarks = detections.landmarks[0];
                const rawGesture = detectGesture(landmarks);
                const rotation = calculateHandRotation(landmarks);
                
                // --- Gesture Stability Logic ---
                // We only switch gesture if the NEW gesture is detected for 2 consecutive frames (approx 100ms at 20fps).
                // This prevents flickering between PINCH and OPEN_PALM.
                if (rawGesture === lastRawGestureRef.current) {
                    gestureConsistencyCount.current++;
                } else {
                    lastRawGestureRef.current = rawGesture;
                    gestureConsistencyCount.current = 1;
                }

                if (gestureConsistencyCount.current >= 2) {
                    stableGestureRef.current = rawGesture;
                }
                
                // Invert X because webcam is mirrored usually
                const posX = 1 - landmarks[9].x; 
                const posY = landmarks[9].y;

                onHandUpdate({
                  gesture: stableGestureRef.current, // Use stable buffered gesture
                  position: { x: posX, y: posY },
                  rotation,
                  isPresent: true
                });
              } else {
                 // Reset stability on loss of hand
                 gestureConsistencyCount.current = 0;
                 lastRawGestureRef.current = 'NONE';
                 stableGestureRef.current = 'NONE';

                 onHandUpdate({
                  gesture: 'NONE',
                  position: { x: 0.5, y: 0.5 },
                  rotation: 0,
                  isPresent: false
                });
              }
            }
        }
        animationFrameId = requestAnimationFrame(predictWebcam);
      }
    };

    setupMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (handLandmarker) handLandmarker.close();
      cancelAnimationFrame(animationFrameId);
    };
  }, [onHandUpdate]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out ${isMinimized ? 'w-12 h-12' : 'w-32 h-24'}`}>
      <div className={`relative w-full h-full overflow-hidden bg-black border-2 border-yellow-600/50 shadow-2xl transition-all duration-300 ${isMinimized ? 'rounded-full' : 'rounded-xl'} group`}>
        
        {/* The video element is ALWAYS rendered to keep the stream active */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${isMinimized ? 'opacity-0' : 'opacity-60 hover:opacity-100'}`}
        />

        {/* --- Minimized State UI --- */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isMinimized ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
             <button
              onClick={() => setIsMinimized(false)}
              className="w-full h-full flex items-center justify-center bg-black/40 backdrop-blur-md hover:bg-yellow-600/20 text-yellow-500"
              title="显示摄像头"
            >
                <ChevronUp size={24} />
                <div className="absolute top-2 right-3 w-2 h-2 bg-green-500 rounded-full opacity-80 animate-pulse"></div>
            </button>
        </div>

        {/* --- Maximized State UI --- */}
        <div className={`absolute inset-0 transition-opacity duration-300 ${!isMinimized ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            {loading && <div className="absolute inset-0 flex items-center justify-center text-xs text-yellow-500 z-10">Init AI...</div>}
            {error && <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 z-10">{error}</div>}
            
            <button 
                onClick={() => setIsMinimized(true)}
                className="absolute top-1 right-1 z-20 text-white/50 hover:text-white bg-black/30 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <ChevronDown size={14} />
            </button>
            
            <div className="absolute bottom-1 left-2 text-[10px] text-white/70 pointer-events-none z-10">Cam Feed</div>
        </div>
      </div>
    </div>
  );
};

export default HandTracker;