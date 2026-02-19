
import React, { useState, useRef, useEffect } from 'react';
import { textures } from '../utils/textures';
import { useStore } from '../store';

interface SliderProps {
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    label: string;
    className?: string;
}

const MinecraftSlider: React.FC<SliderProps> = ({ value, min, max, onChange, label, className = '' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const handleWidth = 20; // Slightly smaller handle for tighter grid

    const updateValue = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const trackWidth = rect.width - handleWidth;
        const relativeX = clientX - rect.left - (handleWidth / 2);
        
        const percentage = Math.max(0, Math.min(1, relativeX / trackWidth));
        const newValue = Math.round(min + percentage * (max - min));
        onChange(newValue);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateValue(e.clientX);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                updateValue(e.clientX);
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const percentage = (value - min) / (max - min);

    return (
        <div 
            ref={containerRef}
            className={`h-10 bg-black border-2 border-b-[#ffffff] border-r-[#ffffff] border-t-[#3f3f3f] border-l-[#3f3f3f] relative cursor-pointer select-none ${className}`}
            onMouseDown={handleMouseDown}
        >
            <div 
                className="absolute top-0 h-full bg-[#5e5e5e] hover:bg-[#707080] border-2 border-b-black border-r-black border-t-[#a0a0a0] border-l-[#a0a0a0]"
                style={{ 
                    width: `${handleWidth}px`,
                    left: `calc(${percentage} * (100% - ${handleWidth}px))`
                }}
            />
             <div className="absolute inset-0 flex items-center justify-center text-white text-shadow-sm pointer-events-none" style={{ textShadow: '2px 2px 0 #202020' }}>
                {label}
            </div>
        </div>
    );
};

const OptionButton: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({ onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    className={`
      h-10
      bg-[#5e5e5e] 
      border-2 border-b-black border-r-black border-t-[#a0a0a0] border-l-[#a0a0a0]
      text-white text-shadow-sm
      flex items-center justify-center
      select-none
      hover:bg-[#707080] active:bg-[#4a4a4a]
      ${className}
    `}
    style={{ textShadow: '2px 2px 0 #202020' }}
  >
    {children}
  </button>
);

interface OptionsScreenProps {
  onBack: () => void;
  isOverlay?: boolean;
}

export const OptionsScreen: React.FC<OptionsScreenProps> = ({ onBack, isOverlay = false }) => {
  const fov = useStore((state) => state.fov);
  const setFov = useStore((state) => state.setFov);
  const renderDistance = useStore((state) => state.renderDistance);
  const setRenderDistance = useStore((state) => state.setRenderDistance);
  const isStalkerEnabled = useStore((state) => state.isStalkerEnabled);
  const setStalkerEnabled = useStore((state) => state.setStalkerEnabled);
  const showShadows = useStore((state) => state.showShadows);
  const setShowShadows = useStore((state) => state.setShowShadows);
  
  const viewBobbing = useStore(state => state.viewBobbing);
  const setViewBobbing = useStore(state => state.setViewBobbing);
  const mouseSensitivity = useStore(state => state.mouseSensitivity);
  const setMouseSensitivity = useStore(state => state.setMouseSensitivity);

  const getFovLabel = (val: number) => {
      if (val === 75) return `FOV: Normal`;
      if (val >= 110) return `FOV: Quake Pro`;
      return `FOV: ${val}`;
  }

  const cycleRenderDistance = () => {
      // Order: Far(12) -> Normal(8) -> Short(4) -> Tiny(2) -> Far
      if (renderDistance >= 12) setRenderDistance(8);
      else if (renderDistance >= 8) setRenderDistance(4);
      else if (renderDistance >= 4) setRenderDistance(2);
      else setRenderDistance(12);
  };

  const getRenderDistanceLabel = () => {
      if (renderDistance >= 12) return "Render Distance: Far";
      if (renderDistance >= 8) return "Render Distance: Normal";
      if (renderDistance >= 4) return "Render Distance: Short";
      return "Render Distance: Tiny";
  };

  const cycleGraphics = () => {
      // Maps Fancy -> Shadows ON, Fast -> Shadows OFF
      setShowShadows(!showShadows);
  };

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{ 
        backgroundImage: isOverlay ? 'none' : `url(${textures.dirt})`,
        backgroundColor: isOverlay ? 'rgba(0,0,0,0.65)' : 'transparent',
        backgroundSize: '64px',
        imageRendering: 'pixelated'
      }}
    >
      {!isOverlay && <div className="absolute inset-0 bg-black/50 pointer-events-none" />}
      
      <div className="z-10 flex flex-col items-center w-full max-w-2xl pointer-events-auto">
        <h2 className="text-4xl font-bold text-white mb-8" style={{ textShadow: '2px 2px 0 #3f3f3f' }}>OPTIONS</h2>
        
        {/* Main Grid: Reduced width and centered items */}
        <div className="grid grid-cols-2 gap-3 w-[400px] mb-8">
            <MinecraftSlider 
                min={0} max={200} value={mouseSensitivity} onChange={setMouseSensitivity} 
                label={`Sensitivity: ${mouseSensitivity === 0 ? '*yawn*' : (mouseSensitivity === 200 ? 'HYPERSPEED!!!' : mouseSensitivity + '%')}`} 
            />
            
            <MinecraftSlider 
                min={30} max={110} value={fov} onChange={setFov} 
                label={getFovLabel(fov)} 
            />
            
            <OptionButton onClick={() => setViewBobbing(!viewBobbing)}>
                {`View Bobbing: ${viewBobbing ? 'ON' : 'OFF'}`}
            </OptionButton>

            <OptionButton onClick={cycleGraphics}>
                {`Graphics: ${showShadows ? 'Fancy' : 'Fast'}`}
            </OptionButton>
            
            <OptionButton onClick={cycleRenderDistance}>
                {getRenderDistanceLabel()}
            </OptionButton>

             <OptionButton onClick={() => setStalkerEnabled(!isStalkerEnabled)}>
                {`Stalker: ${isStalkerEnabled ? 'ON' : 'OFF'}`}
            </OptionButton>
            
        </div>
        
        <OptionButton className="w-[400px]" onClick={onBack}>
            Done
        </OptionButton>
      </div>
    </div>
  );
};
