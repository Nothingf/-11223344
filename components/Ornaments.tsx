import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ParticleData, AppMode } from '../types';
import { CONFIG, PALETTE, LIGHT_PALETTE, COLORS } from '../constants';
import { easing } from 'maath';

interface OrnamentsProps {
  mode: AppMode;
  rotationOffset: number;
}

interface Shader {
  uniforms: { [uniform: string]: { value: any } };
  vertexShader: string;
  fragmentShader: string;
}

const PARTICLE_SHADER_HEAD = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uSpin;
  
  attribute vec3 aTreePos;
  attribute vec3 aScatterPos;
  attribute vec3 aMeta;
  attribute vec3 aRotationSpeed;
  
  mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
  }

  mat4 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat4(c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1);
  }
`;

const PARTICLE_SHADER_BODY = `
  vec3 targetPos = mix(aTreePos, aScatterPos, uProgress);
  if (uProgress > 0.01) {
      float floatAmount = sin(uTime + aMeta.z) * 0.05 * uProgress;
      targetPos.y += floatAmount;
  }
  vec4 worldPos = rotateY(uSpin) * vec4(targetPos, 1.0);
  float currentScale = aMeta.x;
  if (aMeta.y > 0.0) {
      float flash = sin(uTime * aMeta.y + aMeta.z);
      float intensity = 1.0 + flash * 0.3; 
      currentScale *= intensity;
  }
  currentScale *= (1.0 + uProgress * 0.3);
  vec3 transformedLocal = position * currentScale;
  if (length(aRotationSpeed) > 0.0) {
      mat4 rotX = rotationMatrix(vec3(1,0,0), uTime * aRotationSpeed.x);
      mat4 rotY = rotationMatrix(vec3(0,1,0), uTime * aRotationSpeed.y);
      transformedLocal = (rotY * rotX * vec4(transformedLocal, 1.0)).xyz;
  }
  transformedLocal = (rotateY(uSpin) * vec4(transformedLocal, 1.0)).xyz;
  vec3 finalPosition = transformedLocal + worldPos.xyz;
  vec3 transformed = finalPosition;
`;

const PARTICLE_NORMAL_FIX = `
  float s_n = sin(uSpin);
  float c_n = cos(uSpin);
  mat2 m_n = mat2(c_n, -s_n, s_n, c_n);
  objectNormal.xz = m_n * objectNormal.xz;
`;

const injectShader = (shader: Shader, uniformsRef: React.MutableRefObject<any>) => {
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uProgress = { value: 0 };
  shader.uniforms.uSpin = { value: 0 };
  uniformsRef.current = shader.uniforms;
  shader.vertexShader = PARTICLE_SHADER_HEAD + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', PARTICLE_SHADER_BODY);
  shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${PARTICLE_NORMAL_FIX}`);
};

const starShape = new THREE.Shape();
const outerRadius = 0.8;
const innerRadius = 0.35;
const points = 5;
for (let i = 0; i < points * 2; i++) {
  const r = i % 2 === 0 ? outerRadius : innerRadius;
  const a = (i / (points * 2)) * Math.PI * 2;
  const x = Math.cos(a + Math.PI / 2) * r;
  const y = Math.sin(a + Math.PI / 2) * r;
  if (i === 0) starShape.moveTo(x, y);
  else starShape.lineTo(x, y);
}

export const Star: React.FC<{ mode: AppMode }> = ({ mode }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    
    if (mode === 'ASSEMBLED') {
        groupRef.current.rotation.y = -t * 0.1;
    } else {
        groupRef.current.rotation.y += delta * 0.2;
    }

    const floatY = Math.sin(t * 1.5) * 0.1;
    const topOfTreeY = CONFIG.TREE_HEIGHT / 2;
    const targetY = (mode === 'DISPERSED' || mode === 'FOCUS')
      ? topOfTreeY + 9 
      : topOfTreeY + 0.8 + floatY;

    const smoothTime = mode === 'DISPERSED' ? 0.4 : 0.5;
    easing.damp(groupRef.current.position, 'y', targetY, smoothTime, delta);
    
    const scale = 1 + Math.sin(t * 4) * 0.05;
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.TREE_HEIGHT / 2, 0]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[starShape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }]} />
        <meshStandardMaterial 
          color={COLORS.METALLIC_GOLD} 
          emissive={COLORS.METALLIC_GOLD} 
          emissiveIntensity={8}
          roughness={0.1}
          metalness={1.0}
          toneMapped={false}
        />
      </mesh>
      <pointLight intensity={8} distance={15} color="#ffd700" decay={2} />
    </group>
  );
};

const Ornaments: React.FC<OrnamentsProps> = ({ mode, rotationOffset }) => {
    const giftsRef = useRef<THREE.InstancedMesh>(null);
    const ballsRef = useRef<THREE.InstancedMesh>(null);
    const lightsRef = useRef<THREE.InstancedMesh>(null);
    const glitterRef = useRef<THREE.InstancedMesh>(null);
    
    const smoothedRotation = useRef(rotationOffset);
    const spinVelocity = useRef(0);
    const accumulatedSpin = useRef(0);
    const prevMode = useRef<AppMode>(mode);
    const progressRef = useRef(0);
    const uniformsRefs = useRef<Array<Record<string, { value: any }>>>([]);

    const { gifts, balls, lights, glitters } = useMemo(() => {
        const giftList: ParticleData[] = [];
        const ballList: ParticleData[] = [];
        const lightList: ParticleData[] = [];
        const glitterList: ParticleData[] = [];

        const getSphericalPos = (minR: number, maxR: number) => {
             const r = minR + Math.random() * (maxR - minR);
             const theta = 2 * Math.PI * Math.random();
             const phi = Math.acos(2 * Math.random() - 1);
             return [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)] as [number, number, number];
        };

        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const rand = Math.random();
            let category: 'GIFT' | 'BALL' | 'LIGHT';
            if (rand < 0.25) category = 'GIFT';
            else if (rand < 0.55) category = 'BALL';
            else category = 'LIGHT';

            let color: THREE.Color;
            let scale: number;
            let flashSpeed = 0;

            if (category === 'GIFT') {
                color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                scale = Math.random() * 0.12 + 0.15; 
                if (Math.random() < 0.1) flashSpeed = 2 + Math.random() * 3;
            } else if (category === 'BALL') {
                color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                scale = Math.random() * 0.1 + 0.12; 
                if (Math.random() < 0.3) flashSpeed = 3 + Math.random() * 4;
            } else {
                color = LIGHT_PALETTE[Math.floor(Math.random() * LIGHT_PALETTE.length)];
                scale = Math.random() * 0.04 + 0.03;
                if (Math.random() < 0.9) flashSpeed = 1 + Math.random() * 4;
            }

            const u = Math.random();
            const h = CONFIG.TREE_HEIGHT * (1 - Math.sqrt(u));
            const rMaxAtH = (CONFIG.TREE_RADIUS_BOTTOM * (CONFIG.TREE_HEIGHT - h)) / CONFIG.TREE_HEIGHT;
            const r = Math.pow(Math.random(), 0.8) * rMaxAtH; 
            const angle = Math.random() * Math.PI * 2;
            const tx = Math.cos(angle) * r;
            const tz = Math.sin(angle) * r;
            const ty = h - CONFIG.TREE_HEIGHT / 2;
            const [sx, sy, sz] = getSphericalPos(6.5, 12.0);

            const data: ParticleData = {
                id: i, category, position: [tx, ty, tz], treePosition: [tx, ty, tz], scatterPosition: [sx, sy, sz],
                color, scale, rotationSpeed: [Math.random(), Math.random(), Math.random()], flashSpeed, flashOffset: Math.random() * 100
            };

            if (category === 'GIFT') giftList.push(data);
            else if (category === 'BALL') ballList.push(data);
            else lightList.push(data);
        }

        for (let i = 0; i < CONFIG.GLITTER_COUNT; i++) {
             const u = Math.random();
             const h = CONFIG.TREE_HEIGHT * (1 - Math.sqrt(u));
             const rMaxAtH = (CONFIG.TREE_RADIUS_BOTTOM * (CONFIG.TREE_HEIGHT - h)) / CONFIG.TREE_HEIGHT;
             const r = Math.sqrt(Math.random()) * rMaxAtH * 1.3; 
             const angle = Math.random() * Math.PI * 2;
             const tx = Math.cos(angle) * r;
             const tz = Math.sin(angle) * r;
             const ty = h - CONFIG.TREE_HEIGHT / 2;
             const [sx, sy, sz] = getSphericalPos(6.5, 13.0);
             glitterList.push({
                id: i + 10000, category: 'LIGHT', position: [tx, ty, tz], treePosition: [tx, ty, tz], scatterPosition: [sx, sy, sz],
                color: COLORS.GLITTER, scale: Math.random() * 0.04 + 0.015, rotationSpeed: [0,0,0], flashSpeed: 3 + Math.random() * 6, flashOffset: Math.random() * 100
             });
        }
        return { gifts: giftList, balls: ballList, lights: lightList, glitters: glitterList };
    }, []);

    useEffect(() => {
        uniformsRefs.current = [];
        const groups = [
            { ref: giftsRef, data: gifts, hasShadows: true, hasRotation: true },
            { ref: ballsRef, data: balls, hasShadows: true, hasRotation: false },
            { ref: lightsRef, data: lights, hasShadows: false, hasRotation: false },
            { ref: glitterRef, data: glitters, hasShadows: false, hasRotation: false }
        ];

        groups.forEach(({ ref, data, hasShadows, hasRotation }) => {
            if (!ref.current) return;
            const count = data.length;
            const geo = ref.current.geometry;

            const aTreePos = new Float32Array(count * 3);
            const aScatterPos = new Float32Array(count * 3);
            const aMeta = new Float32Array(count * 3);
            const aRotationSpeed = new Float32Array(count * 3);

            for (let i = 0; i < count; i++) {
                const d = data[i];
                const i3 = i * 3;
                aTreePos[i3] = d.treePosition[0]; aTreePos[i3 + 1] = d.treePosition[1]; aTreePos[i3 + 2] = d.treePosition[2];
                aScatterPos[i3] = d.scatterPosition[0]; aScatterPos[i3 + 1] = d.scatterPosition[1]; aScatterPos[i3 + 2] = d.scatterPosition[2];
                aMeta[i3] = d.scale; aMeta[i3 + 1] = d.flashSpeed; aMeta[i3 + 2] = d.flashOffset;
                if (hasRotation) { aRotationSpeed[i3] = d.rotationSpeed[0]; aRotationSpeed[i3 + 1] = d.rotationSpeed[1]; aRotationSpeed[i3 + 2] = d.rotationSpeed[2]; }
                ref.current.setColorAt(i, d.color);
            }

            geo.setAttribute('aTreePos', new THREE.InstancedBufferAttribute(aTreePos, 3));
            geo.setAttribute('aScatterPos', new THREE.InstancedBufferAttribute(aScatterPos, 3));
            geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(aMeta, 3));
            geo.setAttribute('aRotationSpeed', new THREE.InstancedBufferAttribute(aRotationSpeed, 3));
            if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;

            const mat = ref.current.material as THREE.Material;
            mat.onBeforeCompile = (shader) => {
                const uRef = { current: null };
                injectShader(shader as Shader, uRef);
                if (uRef.current) uniformsRefs.current.push(uRef.current);
            };
            mat.needsUpdate = true;

            if (hasShadows) {
                const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
                depthMat.onBeforeCompile = (shader) => {
                    const uRef = { current: null };
                    injectShader(shader as Shader, uRef);
                    if (uRef.current) uniformsRefs.current.push(uRef.current);
                };
                ref.current.customDepthMaterial = depthMat;
                const distMat = new THREE.MeshDistanceMaterial();
                distMat.onBeforeCompile = (shader) => {
                    const uRef = { current: null };
                    injectShader(shader as Shader, uRef);
                    if (uRef.current) uniformsRefs.current.push(uRef.current);
                };
                ref.current.customDistanceMaterial = distMat;
            }
        });
    }, [gifts, balls, lights, glitters]);

    useFrame((state, delta) => {
        const time = state.clock.getElapsedTime();
        if (prevMode.current !== mode) {
            if (mode === 'DISPERSED' && prevMode.current === 'ASSEMBLED') spinVelocity.current = -12.0;
            else if (mode === 'ASSEMBLED') spinVelocity.current = 20.0;
            else if (mode === 'FOCUS') spinVelocity.current = 0;
            prevMode.current = mode;
        }
        const friction = mode === 'DISPERSED' ? 0.82 : 0.85;
        spinVelocity.current *= friction; 
        accumulatedSpin.current += spinVelocity.current * delta;
        easing.damp(smoothedRotation, 'current', rotationOffset, 0.4, delta);
        const targetProgress = mode === 'ASSEMBLED' ? 0 : 1;
        const smoothTime = mode === 'DISPERSED' ? 0.4 : 0.5;
        easing.damp(progressRef, 'current', targetProgress, smoothTime, delta);
        const baseSpin = (time * 0.1) + accumulatedSpin.current;
        const handComponent = smoothedRotation.current * 3.0 * progressRef.current;
        const finalSpin = baseSpin + handComponent;
        uniformsRefs.current.forEach(uniforms => {
            if (uniforms.uTime) uniforms.uTime.value = time;
            if (uniforms.uProgress) uniforms.uProgress.value = progressRef.current;
            if (uniforms.uSpin) uniforms.uSpin.value = finalSpin;
        });
    });

    return (
        <group>
          <instancedMesh ref={giftsRef} args={[undefined, undefined, gifts.length]} castShadow receiveShadow frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={0.3} metalness={0.45} envMapIntensity={0.25} />
          </instancedMesh>
          <instancedMesh ref={ballsRef} args={[undefined, undefined, balls.length]} receiveShadow frustumCulled={false}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial roughness={0.12} metalness={0.45} envMapIntensity={0.25} />
          </instancedMesh>
          <instancedMesh ref={lightsRef} args={[undefined, undefined, lights.length]} frustumCulled={false}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial toneMapped={false} emissiveIntensity={8} color="#ffffff" emissive="#ffffff" />
          </instancedMesh>
          <instancedMesh ref={glitterRef} args={[undefined, undefined, glitters.length]} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={COLORS.GLITTER.clone().multiplyScalar(10)} side={THREE.DoubleSide} transparent opacity={0.8} blending={THREE.AdditiveBlending} toneMapped={false} />
          </instancedMesh>
        </group>
      );
};

export default Ornaments;
