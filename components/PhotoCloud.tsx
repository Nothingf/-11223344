import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';
import { RoundedBox } from '@react-three/drei';
import { PhotoData, AppMode } from '../types';
import { CONFIG } from '../constants';

interface PhotoCloudProps {
  photos: PhotoData[];
  mode: AppMode;
  rotationOffset: number;
  focusId: string | null;
}

// --- SHARED RESOURCES ---
let _sharedBumpMap: THREE.DataTexture | null = null;
const getSharedBumpMap = () => {
  if (_sharedBumpMap) return _sharedBumpMap;
  const width = 512;
  const height = 512;
  const size = width * height;
  const data = new Uint8Array(4 * size);
  for (let i = 0; i < size; i++) {
    const v = Math.random() * 255; 
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.needsUpdate = true;
  _sharedBumpMap = texture;
  return _sharedBumpMap;
};

// --- TYPES FOR SHOWCASE SYSTEM ---
interface ShowcaseParticipant {
    id: string;
    offsetAngle: number; // 0 or PI
    launchTime: number;
    hasPresented: boolean;
    originalSlotAngle: number;
}

interface ShowcaseSystemState {
    active: Record<string, ShowcaseParticipant>;
    systemAngle: number;
    phase: 'COOLDOWN' | 'ACTIVE';
    cooldownUntil: number;
    lapCounter: number; // To track how many rotations have passed
}

// --- FRAME COMPONENT ---
const Frame: React.FC<{ 
  data: PhotoData; 
  mode: AppMode; 
  rotationOffset: number;
  isFocused: boolean; 
  spinRef: React.MutableRefObject<number>;
  showcaseSystemRef: React.MutableRefObject<ShowcaseSystemState>;
}> = ({ 
    data, mode, rotationOffset, isFocused, spinRef, showcaseSystemRef
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(1);
  const { viewport, camera } = useThree();
  const smoothedRot = useRef(rotationOffset);

  // Load Texture
  useEffect(() => {
    if (!data.url) return;
    const loader = new THREE.TextureLoader();
    loader.load(data.url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const imgAspect = tex.image.width / tex.image.height;
      setAspect(imgAspect);
      setTexture(tex);
    });
  }, [data.url]);

  const idSeed = useMemo(() => data.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0), [data.id]);
  const bumpMap = useMemo(() => getSharedBumpMap(), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const currentSpin = spinRef.current;

    // Hand Rotation Smoothing
    easing.damp(smoothedRot, 'current', rotationOffset, 0.4, delta);

    let targetPos = new THREE.Vector3();
    let targetRot = new THREE.Euler();
    let targetScale = 1;
    let smoothTime = 0.5;

    // --- CHECK SHOWCASE STATUS (From Ref) ---
    const showcase = showcaseSystemRef.current;
    const participant = showcase.active[data.id];
    // Effectively active if in map AND launch time passed
    const isShowcaseActive = !!participant && (time >= participant.launchTime);

    // --- STATE MACHINE ---

    if (isFocused && mode === 'FOCUS') {
      // --- FOCUS MODE ---
      const distFromCamera = 4;
      const zPos = 22 - distFromCamera; 
      targetPos.set(0, 0, zPos); 
      targetPos.y += Math.sin(time * 1.5) * 0.15; 
      targetRot.set(Math.sin(time * 0.8) * 0.05, Math.sin(time * 0.6) * 0.05, 0);
      
      const vFOV = (camera as any).fov * Math.PI / 180;
      const visibleHeight = 2 * Math.tan(vFOV / 2) * distFromCamera;
      const visibleWidth = visibleHeight * viewport.aspect;
      if (aspect > (visibleWidth * 0.8) / (visibleHeight * 0.8)) {
          targetScale = (visibleWidth * 0.8) / aspect; 
      } else {
          targetScale = visibleHeight * 0.8;
      }
      smoothTime = 0.4;

    } else if (isShowcaseActive && mode === 'ASSEMBLED') {
      // --- SHOWCASE MODE (Orbiting) ---
      
      // Radius adjusted to 1.6 as requested
      const R = CONFIG.TREE_RADIUS_BOTTOM * 1.6;
      const myAngle = showcase.systemAngle + participant.offsetAngle;

      const bob = Math.sin(time * 2 + idSeed) * 0.5;
      targetPos.set(
          Math.cos(myAngle) * R,
          0 + bob, 
          Math.sin(myAngle) * R
      );

      // Presentation Check (Local)
      const normAngle = (myAngle + Math.PI * 2) % (Math.PI * 2);
      let dist = Math.abs(normAngle - Math.PI / 2);
      if (dist > Math.PI) dist = 2 * Math.PI - dist;
      
      // If we are in the slow-down zone, face the camera and scale up
      const isPresentationZone = dist < 0.5; 

      if (isPresentationZone && showcase.lapCounter >= 2) {
          targetRot.set(0, 0, 0);
          // Increased scale from 1.6 to 1.9 for better visibility
          targetScale = 1.9;
      } else {
          targetRot.set(0, -myAngle + Math.PI / 2, 0);
          targetScale = 1.25;
      }
      smoothTime = 0.6; 

    } else if (mode === 'ASSEMBLED') {
      // --- ASSEMBLED (Tree) MODE ---
      targetPos.set(...data.treePosition);
      const initialAngle = Math.atan2(targetPos.x, targetPos.z);
      const rotY = time * 0.1 + currentSpin;
      
      const x = targetPos.x * Math.cos(rotY) - targetPos.z * Math.sin(rotY);
      const z = targetPos.x * Math.sin(rotY) + targetPos.z * Math.cos(rotY);
      targetPos.set(x, targetPos.y, z);

      targetRot.set(0, initialAngle + rotY, 0);
      targetScale = 1.25;
      smoothTime = 0.5;

    } else {
      // --- DISPERSED MODE ---
      targetPos.set(...data.scatterPosition);
      const rotTotal = (time * 0.1) + (smoothedRot.current * 3.0) + currentSpin;
      const x = targetPos.x * Math.cos(rotTotal) - targetPos.z * Math.sin(rotTotal);
      const z = targetPos.x * Math.sin(rotTotal) + targetPos.z * Math.cos(rotTotal);
      targetPos.set(x, targetPos.y + Math.sin(time * 0.5 + idSeed) * 0.05, z);
      targetRot.set(
        Math.sin(time * 0.5 + idSeed) * 0.05,
        Math.cos(time * 0.3 + idSeed) * 0.05,
        0
      );
      targetScale = 1.6;
      smoothTime = 0.25;
    }

    easing.damp3(groupRef.current.position, targetPos, smoothTime, delta);
    easing.dampE(groupRef.current.rotation, targetRot, smoothTime, delta);
    easing.damp(groupRef.current.scale, 'x', targetScale, smoothTime, delta);
    easing.damp(groupRef.current.scale, 'y', targetScale, smoothTime, delta);
    easing.damp(groupRef.current.scale, 'z', targetScale, smoothTime, delta);
  });

  if (!texture) return null;

  // Use state-independent priority based on ref data from last frame (approximation ok)
  const showcase = showcaseSystemRef.current;
  const isShowcaseActive = !!showcase.active[data.id];
  const isPriority = isFocused || isShowcaseActive;
  
  // High render order ensures it renders on top of transparent effects IF depth test passes.
  // We want standard opaque rendering behavior (depthTest=true, depthWrite=true)
  // so it correctly hides behind the tree when orbiting back.
  const renderOrder = isPriority ? 100 : 1;

  // Frame Dimensions
  const PHOTO_W = aspect;
  const PHOTO_H = 1;
  const MAT_BORDER = 0.08; 
  const FRAME_BORDER = 0.06; 
  const MAT_W = PHOTO_W + MAT_BORDER * 2;
  const MAT_H = PHOTO_H + MAT_BORDER * 2;
  const FRAME_W = MAT_W + FRAME_BORDER * 2;
  const FRAME_H = MAT_H + FRAME_BORDER * 2;
  const FRAME_DEPTH = 0.12; 

  return (
    <group ref={groupRef} renderOrder={renderOrder}>
      {/* Enable cast/receive shadow for the main frame body */}
      <RoundedBox args={[FRAME_W, FRAME_H, FRAME_DEPTH]} radius={0.03} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial 
          color="#d4af37" 
          roughness={0.45} 
          metalness={1.0}
          envMapIntensity={2.5}
          bumpMap={bumpMap}
          bumpScale={0.005} 
        />
      </RoundedBox>
      
      {/* Mat receives shadow */}
      <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.001]} renderOrder={renderOrder + 1} receiveShadow>
        <planeGeometry args={[MAT_W, MAT_H]} />
        <meshStandardMaterial color="#fdfdfd" roughness={0.9} />
      </mesh>
      
      {/* Photo itself receives shadow */}
      <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.002]} renderOrder={renderOrder + 2} receiveShadow>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      
      {/* Back Mat */}
      <mesh position={[0, 0, -FRAME_DEPTH / 2 - 0.001]} rotation={[0, Math.PI, 0]} renderOrder={renderOrder + 1} receiveShadow>
        <planeGeometry args={[MAT_W, MAT_H]} />
        <meshStandardMaterial color="#fdfdfd" roughness={0.9} />
      </mesh>
      
      {/* Back Photo */}
      <mesh position={[0, 0, -FRAME_DEPTH / 2 - 0.002]} rotation={[0, Math.PI, 0]} renderOrder={renderOrder + 2} receiveShadow>
        <planeGeometry args={[PHOTO_W, PHOTO_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
};

// --- CONTROLLER COMPONENT ---
const PhotoCloud: React.FC<PhotoCloudProps> = ({ photos, mode, rotationOffset, focusId }) => {
  const spinVelocity = useRef(0);
  const accumulatedSpin = useRef(0);
  const spinRef = useRef(0);
  const prevMode = useRef<AppMode>(mode);

  // --- SHOWCASE SYSTEM STATE (REF ONLY) ---
  const showcaseSystemRef = useRef<ShowcaseSystemState>({
      active: {},
      systemAngle: 0,
      phase: 'COOLDOWN',
      // INITIAL DELAY: 6 seconds on first load
      cooldownUntil: 6.0,
      lapCounter: 0
  });

  // Track previous angle to count laps
  const prevSystemAngle = useRef(0);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    // --- PHYSICS (Common) ---
    if (prevMode.current !== mode) {
        if (mode === 'DISPERSED' && prevMode.current === 'ASSEMBLED') spinVelocity.current = -12.0;
        else if (mode === 'ASSEMBLED') spinVelocity.current = 20.0;
        else if (mode === 'FOCUS') spinVelocity.current = 0;
        prevMode.current = mode;
    }
    const friction = mode === 'DISPERSED' ? 0.82 : 0.85;
    spinVelocity.current *= friction; 
    accumulatedSpin.current += spinVelocity.current * delta;
    spinRef.current = accumulatedSpin.current;

    // --- SHOWCASE SCHEDULER LOGIC ---
    if (mode === 'ASSEMBLED' && photos.length >= 2) {
        const sys = showcaseSystemRef.current;

        // 1. COOLDOWN -> START
        if (sys.phase === 'COOLDOWN') {
            if (time > sys.cooldownUntil) {
                const candidates = photos.filter(p => p.id !== focusId);
                if (candidates.length >= 2) {
                    const idx1 = Math.floor(Math.random() * candidates.length);
                    let idx2 = (idx1 + Math.floor(candidates.length / 2)) % candidates.length;
                    if (idx1 === idx2) idx2 = (idx1 + 1) % candidates.length;
                    
                    const p1 = candidates[idx1];
                    const p2 = candidates[idx2];

                    sys.systemAngle = Math.random() * Math.PI * 2;
                    sys.phase = 'ACTIVE';
                    sys.lapCounter = 0;
                    prevSystemAngle.current = sys.systemAngle;
                    
                    sys.active = {
                        [p1.id]: {
                            id: p1.id,
                            offsetAngle: 0,
                            launchTime: time, // A leaves now
                            hasPresented: false,
                            originalSlotAngle: Math.atan2(p1.treePosition[0], p1.treePosition[2])
                        },
                        [p2.id]: {
                            id: p2.id,
                            offsetAngle: Math.PI, // 180 degrees apart
                            launchTime: time + 0.7, // B leaves 0.7s later
                            hasPresented: false,
                            originalSlotAngle: Math.atan2(p2.treePosition[0], p2.treePosition[2])
                        }
                    };
                }
            }
        } 
        // 2. ACTIVE LOOP
        else if (sys.phase === 'ACTIVE') {
            let inPresentationZone = false;
            const targetAngle = Math.PI / 2; // Front of camera

            // Check if ANY active photo is in the presentation zone
            for (const key in sys.active) {
                const p = sys.active[key];
                if (time >= p.launchTime) {
                    const myAngle = (sys.systemAngle + p.offsetAngle) % (Math.PI * 2);
                    const normAngle = (myAngle + Math.PI * 2) % (Math.PI * 2);
                    let dist = Math.abs(normAngle - targetAngle);
                    if (dist > Math.PI) dist = 2 * Math.PI - dist;
                    
                    // "Slow down zone"
                    if (dist < 0.4 && sys.lapCounter >= 2) {
                        inPresentationZone = true;
                    }
                }
            }

            // --- ORBIT SPEED CONTROL ---
            // Normal: 2.5 rad/s. Presentation: 0.3 rad/s (Slow motion)
            const targetSpeed = inPresentationZone ? 0.3 : 2.5;
            
            const speed = targetSpeed; 
            sys.systemAngle += speed * delta;

            // Track Laps
            const totalRot = sys.systemAngle;
            const prevRot = prevSystemAngle.current;
            // Check if we crossed a 2PI threshold
            const laps = Math.floor(totalRot / (Math.PI * 2));
            const prevLaps = Math.floor(prevRot / (Math.PI * 2));
            if (laps > prevLaps) {
                sys.lapCounter++;
            }
            prevSystemAngle.current = sys.systemAngle;

            // --- PRESENTATION & RETURN LOGIC ---
            
            for (const key in sys.active) {
                const p = sys.active[key];
                
                // 1. Mark Presented
                if (!p.hasPresented && time >= p.launchTime && sys.lapCounter >= 2) {
                    const myAngle = (sys.systemAngle + p.offsetAngle) % (Math.PI * 2);
                    const normAngle = (myAngle + Math.PI * 2) % (Math.PI * 2);
                    let dist = Math.abs(normAngle - targetAngle);
                    if (dist > Math.PI) dist = 2 * Math.PI - dist;
                    
                    // Passed the peak of presentation
                    if (dist < 0.1) {
                        p.hasPresented = true;
                    }
                }
            }

            // 2. Check for RETURN Opportunity
            const toRemove: string[] = [];

            for (const key in sys.active) {
                const p = sys.active[key];
                
                if (p.hasPresented && !inPresentationZone) {
                    // Check alignment with tree slot
                    // Tree Rotation Global: (time * 0.1 + spinRef.current)
                    // Photo Slot Angle Local: p.originalSlotAngle
                    // Current Slot World Angle:
                    const treeRot = (time * 0.1 + spinRef.current) % (Math.PI * 2);
                    const slotWorldAngle = (treeRot + p.originalSlotAngle) % (Math.PI * 2);

                    const currentOrbitAngle = (sys.systemAngle + p.offsetAngle) % (Math.PI * 2);

                    // Diff
                    let diff = Math.abs(currentOrbitAngle - slotWorldAngle);
                    const n1 = (currentOrbitAngle + 2*Math.PI) % (2*Math.PI);
                    const n2 = (slotWorldAngle + 2*Math.PI) % (2*Math.PI);
                    diff = Math.abs(n1 - n2);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;

                    // If aligned within tolerance (e.g. 15 degrees)
                    if (diff < 0.3) {
                        toRemove.push(key);
                    }
                }
            }

            // Cleanup
            if (toRemove.length > 0) {
                toRemove.forEach(k => delete sys.active[k]);
                // If empty, schedule next run
                if (Object.keys(sys.active).length === 0) {
                    sys.phase = 'COOLDOWN';
                    sys.cooldownUntil = time + 6.0;
                }
            }
        }
    } else {
        // Reset if mode changes
        showcaseSystemRef.current.active = {};
        showcaseSystemRef.current.phase = 'COOLDOWN';
        showcaseSystemRef.current.lapCounter = 0;
        // DELAY: Keep pushing the cooldown forward while NOT in ASSEMBLED.
        // This guarantees a 6s wait when switching BACK to ASSEMBLED.
        showcaseSystemRef.current.cooldownUntil = time + 6.0;
    }
  });

  return (
    <group>
      {photos.map((photo) => (
        <Frame 
          key={photo.id} 
          data={photo} 
          mode={mode} 
          rotationOffset={rotationOffset}
          isFocused={focusId === photo.id}
          spinRef={spinRef}
          showcaseSystemRef={showcaseSystemRef}
        />
      ))}
    </group>
  );
};

export default PhotoCloud;