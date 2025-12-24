import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import Ornaments, { Star } from './Ornaments';
import PhotoCloud from './PhotoCloud';
import { AppMode, PhotoData } from '../types';
import { COLORS, CONFIG } from '../constants';

interface ExperienceProps {
  mode: AppMode;
  photos: PhotoData[];
  rotationOffset: number;
  focusId: string | null;
}

const Experience: React.FC<ExperienceProps> = ({ mode, photos, rotationOffset, focusId }) => {
  return (
    <div className="w-full h-full absolute inset-0 bg-gradient-to-b from-gray-900 to-black">
      <Canvas
        shadows
        camera={{ position: [0, 0, 22], fov: 45 }}
        gl={{ antialias: false }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#051008']} />
        
        <fog attach="fog" args={['#051008', 10, 50]} />
        
        <ambientLight intensity={0.6} />
        <spotLight 
          position={[10, 15, 10]} 
          angle={0.5} 
          penumbra={1} 
          intensity={3} 
          castShadow 
          color={COLORS.METALLIC_GOLD}
        />
        <pointLight position={[-10, -5, -10]} intensity={1.5} color={COLORS.CHRISTMAS_RED} />
        <pointLight position={[0, 5, 10]} intensity={1.5} color="#ffffff" distance={20} />

        <Environment preset="city" />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Sparkles count={300} scale={20} size={3} speed={0.4} opacity={0.5} color={COLORS.METALLIC_GOLD} />

        <group position={[0, 0, 0]}>
            <Star mode={mode} />
            <Ornaments mode={mode} rotationOffset={rotationOffset} />
            <PhotoCloud 
                photos={photos} 
                mode={mode} 
                rotationOffset={rotationOffset}
                focusId={focusId}
            />
        </group>

        <EffectComposer enableNormalPass={false}>
          <Bloom 
            luminanceThreshold={1.1} 
            mipmapBlur 
            intensity={1.0} 
            radius={0.7}
          />
          <Noise opacity={0.03} />
          <Vignette eskil={false} offset={0.1} darkness={1.0} />
        </EffectComposer>

        <OrbitControls 
            {...({ 
                enableZoom: false, 
                enablePan: false, 
                enableRotate: false,
                target: [0, 0, 0] 
            } as any)}
        />
      </Canvas>
    </div>
  );
};

export default Experience;
