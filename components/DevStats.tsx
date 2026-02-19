
import React, { useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useStore } from '../store';

export const DevStats: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const { camera } = useThree();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useStore.getState().isChatOpen) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        setVisible(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const el = document.getElementById('debug-stats');
    if (el) {
      el.style.display = visible ? 'block' : 'none';
      if (!visible) {
          el.innerHTML = ''; 
      }
    }
  }, [visible]);

  useFrame((state, delta) => {
    if (!visible) return;
    
    if (state.clock.elapsedTime % 0.1 < 0.05) {
       const el = document.getElementById('debug-stats');
       if (!el) return;

       const fps = delta > 0 ? Math.round(1 / delta) : 0;
       const pos = camera.position;
       const dir = new Vector3();
       camera.getWorldDirection(dir);
       
       let fVal = 0; 
       if (Math.abs(dir.x) > Math.abs(dir.z)) {
           fVal = dir.x > 0 ? 3 : 1; 
       } else {
           fVal = dir.z > 0 ? 0 : 2; 
       }

       el.innerHTML = `
         <div class="mb-0.5">MineReact Alpha 1.0.0</div>
         <div class="mb-4">${fps} fps, 0 chunk updates</div>
         
         <div class="mb-0.5">X: ${pos.x.toFixed(4)}</div>
         <div class="mb-0.5">Y: ${pos.y.toFixed(4)}</div>
         <div class="mb-0.5">Z: ${pos.z.toFixed(4)}</div>
         <div class="mb-0.5">F: ${fVal}</div>
       `;
    }
  });

  return null;
};
