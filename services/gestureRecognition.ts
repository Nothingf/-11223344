// Simplified logic to detect gestures from 3D landmarks
import { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureType } from '../types';

export const detectGesture = (landmarks: NormalizedLandmark[]): GestureType => {
  if (!landmarks || landmarks.length < 21) return 'NONE';

  // Helper: Distance between two points
  const dist = (p1: NormalizedLandmark, p2: NormalizedLandmark) => {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    );
  };

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const wrist = landmarks[0];

  // Calculate stats for all checks
  const tips = [indexTip, middleTip, ringTip, pinkyTip];
  const avgDistToWrist = tips.reduce((acc, tip) => acc + dist(tip, wrist), 0) / 4;
  const pinchDist = dist(thumbTip, indexTip);

  // 1. Detect FIST (PRIORITY CHECK)
  // We check FIST first because in a fist, the thumb often touches the index finger,
  // which causes a false positive PINCH if checked second.
  // Threshold increased to 0.4 (normalized) to robustly capture fists.
  if (avgDistToWrist < 0.4) { 
    return 'FIST';
  }

  // 2. Detect PINCH
  // Check if thumb is touching index.
  // Since we already ruled out FIST, this is a valid Pinch intention.
  if (pinchDist < 0.06) {
    return 'PINCH';
  }

  // 3. Detect OPEN PALM
  // If tips are far from wrist
  if (avgDistToWrist > 0.5) {
    return 'OPEN_PALM';
  }

  return 'NONE';
};

export const calculateHandRotation = (landmarks: NormalizedLandmark[]) => {
  // Use Wrist (0) and Middle Finger MCP (9) to determine horizontal rotation
  const wrist = landmarks[0];
  const middleMCP = landmarks[9];
  
  // Calculate delta X relative to the frame center (assuming 0.5 is center)
  const centerX = (wrist.x + middleMCP.x) / 2;
  return (centerX - 0.5) * 2; // Returns -1 to 1
};