import * as THREE from 'three';
import React from 'react';

export type AppMode = 'ASSEMBLED' | 'DISPERSED' | 'FOCUS';

export type GestureType = 'NONE' | 'FIST' | 'OPEN_PALM' | 'PINCH' | 'POINT';

export type ParticleCategory = 'GIFT' | 'BALL' | 'LIGHT';

export interface ParticleData {
  id: number;
  category: ParticleCategory;
  position: [number, number, number]; // Current visual position
  treePosition: [number, number, number]; // Target position in tree
  scatterPosition: [number, number, number]; // Target position in cloud
  color: THREE.Color;
  scale: number;
  rotationSpeed: [number, number, number];
  flashSpeed: number; // 0 if not flashing, >0 is speed
  flashOffset: number;
}

export interface PhotoData {
  id: string;
  url: string;
  aspectRatio: number;
  treePosition: [number, number, number];
  scatterPosition: [number, number, number];
}

export interface HandState {
  gesture: GestureType;
  position: { x: number; y: number }; // Normalized 0-1
  rotation: number; // For camera rotation control
  isPresent: boolean;
}

// Global JSX Augmentation for React Three Fiber elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      instancedMesh: any;
      boxGeometry: any;
      sphereGeometry: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      pointLight: any;
      ambientLight: any;
      spotLight: any;
      fog: any;
      extrudeGeometry: any;
      color: any;
      primitive: any;
      object3D: any;
    }
  }
}