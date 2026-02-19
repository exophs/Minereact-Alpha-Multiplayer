
import React, { useState } from 'react';
import { textures } from '../utils/textures';
import { useStore } from '../store';

interface TitleScreenProps {
  onStart: () => void;
  onOptions: () => void;
  onMultiplayer: () => void;
}

export const MenuButton: React.FC<{ onClick: (e: React.MouseEvent) => void; children: React.ReactNode; className?: string, disabled?: boolean }> = ({ onClick, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      w-96 h-10 mb-4 
      bg-[#5e5e5e] 
      border-2 border-b-black border-r-black border-t-[#a0a0a0] border-l-[#a0a0a0]
      text-white text-shadow-sm
      flex items-center justify-center
      select-none
      ${disabled ? 'opacity-50 cursor-not-allowed text-[#a0a0a0]' : 'hover:bg-[#707080] active:bg-[#4a4a4a]'}
      ${className}
    `}
    style={{ textShadow: '2px 2px 0 #202020' }}
  >
    {children}
  </button>
);

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, onOptions, onMultiplayer }) => {
  const [showNameInput, setShowNameInput] = useState(false);
  const [name, setName] = useState('');
  const setStoreUsername = useStore(state => state.setUsername);

  const handleStart = () => {
      setShowNameInput(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      // Only allow letters and numbers, no spaces
      if (/^[a-zA-Z0-9]*$/.test(val)) {
          setName(val);
      }
  };

  const handleConfirmName = () => {
      if (name.length > 0) {
          setStoreUsername(name);
          onStart();
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleConfirmName();
      }
  };

  return (
    <div 
      className="absolute inset-0 flex flex-col items-center justify-center z-50"
      style={{ 
        backgroundImage: `url(${textures.dirt})`,
        backgroundSize: '64px',
        imageRendering: 'pixelated'
      }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      
      <div className="z-10 flex flex-col items-center w-full">
        <div className="mb-16 relative">
          <h1 className="text-6xl font-bold text-[#cfcfcf] tracking-wider" style={{ textShadow: '4px 4px 0 #3f3f3f' }}>
            MineReact
          </h1>
          <div className="absolute -bottom-6 right-0 text-yellow-300 font-bold text-xl rotate-[-15deg] animate-pulse" style={{ textShadow: '2px 2px 0 #3f3f3f' }}>
            Alpha!
          </div>
        </div>

        {!showNameInput ? (
            <>
                <MenuButton onClick={handleStart}>Singleplayer</MenuButton>
                <MenuButton onClick={onMultiplayer}>Multiplayer</MenuButton>
                <MenuButton onClick={onOptions}>Options</MenuButton>
            </>
        ) : (
            <div className="flex flex-col items-center bg-black/50 p-6 rounded border-2 border-[#a0a0a0]">
                <p className="text-white mb-4 text-shadow-sm">Enter Username (Letters & Numbers only):</p>
                <input 
                    type="text" 
                    value={name}
                    onChange={handleNameChange}
                    onKeyDown={handleKeyDown}
                    maxLength={16}
                    className="w-80 h-10 mb-6 bg-black border-2 border-[#a0a0a0] text-white px-2 text-center outline-none"
                    autoFocus
                />
                <MenuButton onClick={handleConfirmName} disabled={name.length === 0}>Play Selected World</MenuButton>
                <MenuButton onClick={() => setShowNameInput(false)}>Cancel</MenuButton>
            </div>
        )}
      </div>
    </div>
  );
};
