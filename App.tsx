
import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, DirectionalLight, AmbientLight } from 'three';
import { World } from './components/World';
import { Player } from './components/Player';
import { UI } from './components/UI';
import { DevStats } from './components/DevStats';
import { useStore } from './store';
import { TitleScreen } from './components/TitleScreen';
import { OptionsScreen } from './components/OptionsScreen';
import { Hand } from './components/Hand';
import { Stalker } from './components/Stalker';
import { Drops } from './components/Drops';
import { getSkyState } from './utils/sky';

const CameraController = () => {
    const { camera } = useThree();
    const fov = useStore(state => state.fov);
    useEffect(() => {
        if (camera instanceof PerspectiveCamera) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
    }, [fov, camera]);
    return null;
}

const Environment = () => {
    const { camera, scene } = useThree();
    const light = useRef<DirectionalLight>(null);
    const ambientRef = useRef<AmbientLight>(null);
    const showShadows = useStore(state => state.showShadows);
    const gameTime = useStore(state => state.gameTime);
    const setGameTime = useStore(state => state.setGameTime);
    
    useEffect(() => {
        if (light.current) {
            scene.add(light.current.target);
            return () => {
                scene.remove(light.current.target);
            };
        }
    }, [scene]);

    useFrame((state, delta) => {
        // Update time
        // Day: 0-12000 (20 mins = 1200s) -> 10 ticks/s
        // Night: 12000-24000 (7 mins = 420s) -> 28.57 ticks/s
        
        const currentCycleTime = gameTime % 24000;
        const isDay = currentCycleTime >= 0 && currentCycleTime < 12000;
        const speed = isDay ? 10 : 28.57;
        
        const tick = delta * speed; 
        setGameTime((t) => t + tick);

        const { sunPos, sunIntensity, ambientIntensity } = getSkyState(gameTime);

        if (light.current) {
            // Shadow box logic
            const frustumSize = 160; 
            const mapSize = 4096; 
            const texelSize = frustumSize / mapSize;
            
            const x = camera.position.x;
            const z = camera.position.z;
            
            const snappedX = Math.floor(x / texelSize) * texelSize;
            const snappedZ = Math.floor(z / texelSize) * texelSize;

            const sunDist = 100;
            
            light.current.position.set(
                snappedX + sunPos.x * sunDist, 
                camera.position.y + sunPos.y * sunDist, 
                snappedZ + sunPos.z * sunDist
            );
            light.current.target.position.set(snappedX, camera.position.y, snappedZ);
            light.current.target.updateMatrixWorld();
            
            light.current.intensity = sunIntensity;
        }

        if (ambientRef.current) {
            ambientRef.current.intensity = ambientIntensity;
        }
    });

    return (
        <>
            <directionalLight 
                ref={light}
                castShadow={showShadows}
                shadow-mapSize={[4096, 4096]}
                shadow-camera-left={-80}
                shadow-camera-right={80}
                shadow-camera-top={80}
                shadow-camera-bottom={-80}
                shadow-camera-near={1}
                shadow-camera-far={300}
                shadow-bias={-0.00005}
                shadow-normalBias={0.01}
            />
            <ambientLight ref={ambientRef} />
        </>
    );
}

interface GameProps {
    onQuit: () => void;
}

const Game: React.FC<GameProps> = ({ onQuit }) => {
  const [isLocked, setIsLocked] = useState(false);
  const isStalkerEnabled = useStore((state) => state.isStalkerEnabled);
  const showFog = useStore((state) => state.showFog);
  const showShadows = useStore((state) => state.showShadows);
  const renderDistance = useStore((state) => state.renderDistance);
  const tickFluids = useStore((state) => state.tickFluids);
  
  const cameraSettings = useMemo(() => ({
      fov: 75,
      near: 0.1,
      far: 1000,
      position: [0, 20, 0] as [number, number, number]
  }), []);

  useEffect(() => {
    const onLockChange = () => {
        if (document.pointerLockElement) {
            setIsLocked(true);
        } else {
            setIsLocked(false);
        }
    };
    
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, []);

  // Fluid Simulation Loop
  useEffect(() => {
      const interval = setInterval(() => {
          tickFluids();
      }, 200); 
      return () => clearInterval(interval);
  }, [tickFluids]);

  const fogDist = Math.max(30, (renderDistance * 16) - 16);

  return (
    <>
      <Canvas
        shadows={showShadows}
        camera={cameraSettings} 
        gl={{ alpha: false, antialias: false }} 
        dpr={window.devicePixelRatio}
      >
        <color attach="background" args={['#B1D8FF']} />
        {showFog && <fog attach="fog" args={['#B1D8FF', 10, fogDist]} />}
        
        <CameraController />
        <Environment />
        
        <Suspense fallback={null}>
            <World />
            <Drops />
            <Player setIsLocked={setIsLocked} isLocked={isLocked} />
            {isStalkerEnabled && <Stalker />}
            <Hand />
            <DevStats />
        </Suspense>
      </Canvas>
      
      <UI isLocked={isLocked} onQuit={onQuit} />
      <div id="crosshair" className={isLocked ? 'opacity-100' : 'opacity-0'} />
      <div 
        id="debug-stats" 
        className="fixed top-0 left-0 p-1 text-white text-base leading-snug pointer-events-none z-50 select-none hidden" 
        style={{ textShadow: '2px 2px 0 #000' }}
      ></div>
    </>
  );
};

import { MultiplayerMenu } from './components/MultiplayerMenu';
import { Socket } from 'socket.io-client';

enum GameState {
    TITLE,
    OPTIONS,
    GAME,
    MULTIPLAYER
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.TITLE);
  const [socket, setSocket] = useState<Socket | null>(null);

  return (
    <>
        {gameState === GameState.TITLE && (
            <TitleScreen 
                onStart={() => setGameState(GameState.GAME)}
                onOptions={() => setGameState(GameState.OPTIONS)}
                onMultiplayer={() => setGameState(GameState.MULTIPLAYER)}
            />
        )}
        
        {gameState === GameState.OPTIONS && (
            <OptionsScreen 
                onBack={() => setGameState(GameState.TITLE)}
            />
        )}

        {gameState === GameState.MULTIPLAYER && (
            <MultiplayerMenu 
                onBack={() => setGameState(GameState.TITLE)}
                onJoinGame={(socket, roomId) => {
                    setSocket(socket);
                    setGameState(GameState.GAME);
                }}
            />
        )}

        {gameState === GameState.GAME && (
            <Game onQuit={() => {
                if (socket) {
                    socket.disconnect();
                    setSocket(null);
                }
                setGameState(GameState.TITLE);
            }} />
        )}
    </>
  );
};

export default App;
