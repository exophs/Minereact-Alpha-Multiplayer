
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, TextureLoader, NearestFilter, SRGBColorSpace, Vector3 } from 'three';
import { textures } from '../utils/textures';
import { useStore } from '../store';

export const Hand: React.FC = () => {
  const { camera } = useThree();
  const ref = useRef<Group>(null);
  const armRef = useRef<Group>(null);
  const [swinging, setSwinging] = useState(false);
  const swingProgress = useRef(0);
  const viewBobbing = useStore(state => state.viewBobbing);
  const cameraMode = useStore(state => state.cameraMode);
  
  // Listen for mouse down events globally to trigger animations
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const handleMouseDown = (e: MouseEvent) => {
        if (document.pointerLockElement && (e.button === 0 || e.button === 2)) {
            setSwinging(true);
            swingProgress.current = 0;
            
            // Continuous swinging if held (only for Left Click / Mining)
            if (e.button === 0) {
                 interval = setInterval(() => {
                     setSwinging(true);
                     // Don't reset progress completely to avoid stutter, just ensure flag is true
                 }, 250);
            }
        }
    };
    
    const handleMouseUp = () => {
        if (interval) clearInterval(interval);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
        if (interval) clearInterval(interval);
    };
  }, []);

  const texture = useMemo(() => {
    const t = new TextureLoader().load(textures.skin);
    t.magFilter = NearestFilter;
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);

  useFrame((state, delta) => {
    if (!ref.current || !armRef.current) return;

    ref.current.position.copy(camera.position);
    ref.current.quaternion.copy(camera.quaternion);

    const time = state.clock.elapsedTime;
    
    const swayX = viewBobbing ? Math.sin(time * 2) * 0.02 : 0; 
    const swayY = viewBobbing ? Math.sin(time * 4) * 0.02 : 0;
    
    let swingRotX = 0;
    let swingRotZ = 0;

    if (swinging) {
        swingProgress.current += delta * 15; 
        
        if (swingProgress.current >= Math.PI) {
            swingProgress.current = 0;
            // We check this in the next frame, but setting to false here ends the single swing
            // The interval in useEffect will re-enable it if holding
            setSwinging(false);
        } else {
            const s = Math.sin(swingProgress.current);
            swingRotX = -s * 1.2; 
            swingRotZ = s * 0.6; 
        }
    }

    const restRotX = -0.2;
    const restRotY = -0.3; 
    const restRotZ = 0;

    const basePos = new Vector3(0.4, -0.35 + swayY, -0.6);
    
    armRef.current.position.lerp(basePos, 0.4); 
    
    armRef.current.rotation.x = restRotX + swingRotX;
    armRef.current.rotation.y = restRotY + swayX; 
    armRef.current.rotation.z = restRotZ + swingRotZ; 
  });

  if (cameraMode !== 0) return null;

  return (
    <group ref={ref}>
       <group ref={armRef}>
          <mesh 
            position={[0.1, -0.2, 0.2]} 
            renderOrder={999} 
          >
             <boxGeometry args={[0.25, 0.75, 0.25]} />
             <meshStandardMaterial 
                map={texture} 
                depthTest={false} 
                depthWrite={false} 
                transparent={true}
                roughness={0.8}
             />
          </mesh>
       </group>
    </group>
  );
};
