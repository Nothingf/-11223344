import * as THREE from 'three';

export const COLORS = {
  MATTE_GREEN: new THREE.Color('#237a48'), // Brighter, more vivid green (less dark)
  METALLIC_GOLD: new THREE.Color('#d4af37'),
  CHRISTMAS_RED: new THREE.Color('#8a1c1c'), 
  SILVER: new THREE.Color('#c0c0c0'),
  // Light colors
  LIGHT_WARM: new THREE.Color('#ffdb70'),
  LIGHT_COOL: new THREE.Color('#e0f7fa'),
  LIGHT_RED: new THREE.Color('#ff0000'),
  LIGHT_GREEN: new THREE.Color('#00ff44'), // Bright Green Light
  LIGHT_GOLD: new THREE.Color('#ffaa00'), // Deep Gold Light
  // Special
  GLITTER: new THREE.Color('#fff7cc'),
  WOOD: new THREE.Color('#5d4037'), // Dark Wood
};

export const CONFIG = {
  // Reduced by ~15% from 1600/3200 to make the scene more breathable and refined
  PARTICLE_COUNT: 1350, 
  GLITTER_COUNT: 2700, 
  TREE_HEIGHT: 13,
  TREE_RADIUS_BOTTOM: 4.8,
  CAMERA_DEFAULT_POS: [0, 1, 14] as [number, number, number],
  ANIMATION_SPEED: 0.05,
};

export const PALETTE = [
  COLORS.MATTE_GREEN,
  COLORS.MATTE_GREEN, // High weight for green
  COLORS.METALLIC_GOLD,
  COLORS.CHRISTMAS_RED,
  COLORS.METALLIC_GOLD, 
  COLORS.SILVER,
];

export const LIGHT_PALETTE = [
  COLORS.LIGHT_GOLD, // Gold
  COLORS.LIGHT_GOLD, // Gold
  COLORS.LIGHT_GOLD, // Gold
  COLORS.LIGHT_WARM, // Warm White (replaces silver/cool)
  COLORS.LIGHT_GREEN, // Green
  COLORS.LIGHT_GREEN, // Green
  COLORS.LIGHT_GREEN, // Green
  COLORS.LIGHT_RED,   // Keep some red for accent
];