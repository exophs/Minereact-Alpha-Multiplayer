
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Fog, Color, LineSegments, BoxGeometry, EdgesGeometry } from 'three';
import { useStore } from '../store';
import { BlockType } from '../types';
import { getBlock } from '../utils/worldGen';
import { getSkyState } from '../utils/sky';
import { PlayerModel } from './PlayerModel';

const PLAYER_HEIGHT = 1.8;
const CROUCH_HEIGHT = 1.5;
const PLAYER_WIDTH = 0.6;
const GRAVITY = 18;

const WATER_COLOR = '#06101b';
const WATER_FOG_NEAR = 0.1;
const WATER_FOG_FAR = 12;

// Mining times in seconds
const MINING_TIMES: Record<BlockType, number> = {
    [BlockType.air]: 0,
    [BlockType.water]: 0,
    [BlockType.leaves]: 0.3,
    [BlockType.sand]: 0.5,
    [BlockType.dirt]: 0.5,
    [BlockType.grass]: 0.6,
    [BlockType.planks]: 1.0,
    [BlockType.wood]: 1.0,
    [BlockType.stone]: 1.5,
    [BlockType.cobblestone]: 1.5,
    [BlockType.glass]: 0.3,
    [BlockType.stick]: 0.1,
    [BlockType.coal]: 0.1,
    [BlockType.torch]: 0.1,
    [BlockType.crafting_table]: 1.0,
    [BlockType.bedrock]: Infinity, // Unbreakable
};

const checkBodyCollision = (pos: Vector3, blocks: Record<string, BlockType>, height: number) => {
    // Player AABB
    const w = PLAYER_WIDTH / 2;
    // Shrink width slightly to prevent getting stuck on walls
    const w_collision = w - 0.1; 
    
    const pMinX = pos.x - w_collision;
    const pMaxX = pos.x + w_collision;
    const pMinZ = pos.z - w_collision;
    const pMaxZ = pos.z + w_collision;
    const pMinY = pos.y - height;
    const pMaxY = pos.y;
    
    // Grid bounds to check
    const minX = Math.floor(pMinX + 0.5);
    const maxX = Math.floor(pMaxX + 0.5);
    const minZ = Math.floor(pMinZ + 0.5);
    const maxZ = Math.floor(pMaxZ + 0.5);
    const minY = Math.floor(pMinY + 0.5);
    const maxY = Math.floor(pMaxY + 0.5);

    for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                const type = getBlock(x, y, z, blocks);
                if (type !== BlockType.air && type !== BlockType.water) {
                    // Block AABB
                    const bMinX = x - 0.5;
                    const bMaxX = x + 0.5;
                    const bMinZ = z - 0.5;
                    const bMaxZ = z + 0.5;
                    const bMinY = y - 0.5;
                    const bMaxY = y + 0.5;
                    
                    if (pMaxX > bMinX && pMinX < bMaxX &&
                        pMaxY > bMinY && pMinY < bMaxY &&
                        pMaxZ > bMinZ && pMinZ < bMaxZ) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

const isSupported = (pos: Vector3, blocks: Record<string, BlockType>, height: number) => {
    // Check slightly below feet
    const testPos = pos.clone();
    testPos.y -= 0.05;
    return checkBodyCollision(testPos, blocks, height);
};

const getCollisionY = (pos: Vector3, blocks: Record<string, BlockType>, direction: 'up' | 'down', height: number) => {
    const w = PLAYER_WIDTH / 2;
    const w_collision = w - 0.1;
    
    const minX = Math.floor(pos.x - w_collision + 0.5);
    const maxX = Math.floor(pos.x + w_collision + 0.5);
    const minZ = Math.floor(pos.z - w_collision + 0.5);
    const maxZ = Math.floor(pos.z + w_collision + 0.5);

    if (direction === 'down') {
        // Search downwards from feet
        const startY = Math.floor(pos.y - height + 0.5);
        for(let y = startY; y >= startY - 2; y--) {
            // Check if this Y level has a block intersecting player XZ
            let hasBlock = false;
            for(let x = minX; x <= maxX; x++) {
                for(let z = minZ; z <= maxZ; z++) {
                    const type = getBlock(x,y,z, blocks);
                    if (type !== BlockType.air && type !== BlockType.water) {
                        const bMinX = x - 0.5;
                        const bMaxX = x + 0.5;
                        const bMinZ = z - 0.5;
                        const bMaxZ = z + 0.5;
                        if (pos.x + w_collision > bMinX && pos.x - w_collision < bMaxX &&
                            pos.z + w_collision > bMinZ && pos.z - w_collision < bMaxZ) {
                            hasBlock = true;
                            break;
                        }
                    }
                }
                if(hasBlock) break;
            }
            if(hasBlock) return y;
        }
    } else {
        // Search upwards from head
        const startY = Math.floor(pos.y + 0.5);
        for(let y = startY; y <= startY + 2; y++) {
            let hasBlock = false;
            for(let x = minX; x <= maxX; x++) {
                for(let z = minZ; z <= maxZ; z++) {
                    const type = getBlock(x,y,z, blocks);
                    if (type !== BlockType.air && type !== BlockType.water) {
                        const bMinX = x - 0.5;
                        const bMaxX = x + 0.5;
                        const bMinZ = z - 0.5;
                        const bMaxZ = z + 0.5;
                        if (pos.x + w_collision > bMinX && pos.x - w_collision < bMaxX &&
                            pos.z + w_collision > bMinZ && pos.z - w_collision < bMaxZ) {
                            hasBlock = true;
                            break;
                        }
                    }
                }
                if(hasBlock) return y;
            }
        }
    }
    return null;
};

const useKeyboard = () => {
  const [movement, setMovement] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    crouch: false,
  });
  const cycleCameraMode = useStore(state => state.cycleCameraMode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (useStore.getState().isChatOpen || useStore.getState().isInventoryOpen) return;
      switch (e.code) {
        case 'KeyW': setMovement(m => ({ ...m, forward: true })); break;
        case 'KeyS': setMovement(m => ({ ...m, backward: true })); break;
        case 'KeyA': setMovement(m => ({ ...m, left: true })); break;
        case 'KeyD': setMovement(m => ({ ...m, right: true })); break;
        case 'Space': setMovement(m => ({ ...m, jump: true })); break;
        case 'ControlLeft': setMovement(m => ({ ...m, crouch: true })); break;
        case 'KeyV': cycleCameraMode(); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': setMovement(m => ({ ...m, forward: false })); break;
        case 'KeyS': setMovement(m => ({ ...m, backward: false })); break;
        case 'KeyA': setMovement(m => ({ ...m, left: false })); break;
        case 'KeyD': setMovement(m => ({ ...m, right: false })); break;
        case 'Space': setMovement(m => ({ ...m, jump: false })); break;
        case 'ControlLeft': setMovement(m => ({ ...m, crouch: false })); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [cycleCameraMode]);
  return movement;
};

const raycast = (modifiedBlocks: Record<string, BlockType>, origin: Vector3, direction: Vector3, reach: number) => {
  const startX = Math.floor(origin.x + 0.5);
  const startY = Math.floor(origin.y + 0.5);
  const startZ = Math.floor(origin.z + 0.5);

  let x = startX;
  let y = startY;
  let z = startZ;

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);

  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

  const ox = origin.x + 0.5;
  const oy = origin.y + 0.5;
  const oz = origin.z + 0.5;

  let tMaxX = tDeltaX * (stepX > 0 ? (Math.floor(ox) + 1 - ox) : (ox - Math.floor(ox)));
  let tMaxY = tDeltaY * (stepY > 0 ? (Math.floor(oy) + 1 - oy) : (oy - Math.floor(oy)));
  let tMaxZ = tDeltaZ * (stepZ > 0 ? (Math.floor(oz) + 1 - oz) : (oz - Math.floor(oz)));

  let t = 0;
  let normal = new Vector3(0, 0, 0);
  const maxSteps = reach * 3;

  for (let i = 0; i < maxSteps; i++) {
    const type = getBlock(x, y, z, modifiedBlocks);
    if (type && type !== BlockType.water) {
        return { x, y, z, normal, dist: t };
    }
    if (t > reach) break;
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; normal.set(-stepX, 0, 0);
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal.set(0, 0, -stepZ);
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; normal.set(0, -stepY, 0);
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal.set(0, 0, -stepZ);
      }
    }
  }
  return null;
};

interface PlayerProps {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
}

export const Player: React.FC<PlayerProps> = ({ isLocked }) => {
  const { camera, scene } = useThree();
  const { forward, backward, left, right, jump, crouch } = useKeyboard();
  
  // Actions
  const addBlock = useStore((state) => state.addBlock);
  const removeBlock = useStore((state) => state.removeBlock);
  const setHotbarSlot = useStore((state) => state.setHotbarSlot);
  const removeFromHand = useStore((state) => state.removeFromHand);
  const addDrop = useStore((state) => state.addDrop);
  const addToInventory = useStore((state) => state.addToInventory);
  const removeDrop = useStore((state) => state.removeDrop);
  const takeDamage = useStore((state) => state.takeDamage);
  const heal = useStore((state) => state.heal);
  const setTeleportRequest = useStore((state) => state.setTeleportRequest);

  // Subscriptions that should trigger re-render
  const health = useStore((state) => state.health);
  const isChatOpen = useStore((state) => state.isChatOpen);
  const isInventoryOpen = useStore((state) => state.isInventoryOpen);
  const teleportRequest = useStore((state) => state.teleportRequest);
  const gameTime = useStore((state) => state.gameTime);
  const renderDistance = useStore((state) => state.renderDistance);
  const cameraMode = useStore((state) => state.cameraMode);
  const cycleCameraMode = useStore(state => state.cycleCameraMode);
  const isFlying = useStore(state => state.isFlying);
  const flySpeed = useStore(state => state.flySpeed);
  const walkSpeed = useStore(state => state.walkSpeed);
  const jumpHeight = useStore(state => state.jumpHeight);
  const gamemode = useStore(state => state.gamemode);

  // Refs for physics/logic state
  const playerPos = useRef(new Vector3(0, 30, 0));
  const velocity = useRef(new Vector3());
  const onGround = useRef(false);
  const currentHeight = useRef(PLAYER_HEIGHT);
  const highlightMesh = useRef<LineSegments>(null);
  const isInitialized = useRef(false);
  const fallDistance = useRef(0);
  const lastRegenTime = useRef(0);
  const lastSpacePress = useRef(0);
  
  // View Rotation State (separate from camera.rotation for third person logic)
  const viewRotation = useRef({ x: 0, y: 0 });

  // Body Rotation State
  const bodyRotation = useRef(0);

  // Mining State
  const isMining = useRef(false);
  const miningTarget = useRef<{x:number, y:number, z:number} | null>(null);
  const miningProgress = useRef(0);
  const isFirstBreak = useRef(true);
  
  // Model state reference
  const modelRef = useRef({
      position: new Vector3(), 
      rotationY: 0, 
      headPitch: 0, 
      headYaw: 0,
      isMoving: false,
      swingTrigger: 0
  });
  
  const selectionGeo = useMemo(() => {
    const geometry = new BoxGeometry(1.002, 1.002, 1.002);
    return new EdgesGeometry(geometry);
  }, []);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  // Unlock cursor on death
  useEffect(() => {
    if (health <= 0 && isLocked) {
        document.exitPointerLock();
    }
  }, [health, isLocked]);

  // Double jump listener for Creative Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (useStore.getState().isChatOpen) return;
        if (e.code === 'Space') {
            const state = useStore.getState();
            if (state.gamemode === 'creative') {
                const now = Date.now();
                if (now - lastSpacePress.current < 300) {
                    state.toggleFlying();
                    lastSpacePress.current = 0;
                } else {
                    lastSpacePress.current = now;
                }
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isLocked) return;
    const onMouseMove = (e: MouseEvent) => {
        if (useStore.getState().isInventoryOpen) return;
        const { movementX, movementY } = e;
        if (Math.abs(movementX) > 100 || Math.abs(movementY) > 100) return;
        const settings = useStore.getState();
        const baseSensitivity = 0.002;
        const sensitivityMult = settings.mouseSensitivity / 100;
        const sensitivity = baseSensitivity * sensitivityMult;
        const invert = settings.invertMouse ? 1 : -1;
        
        viewRotation.current.y -= movementX * sensitivity;
        viewRotation.current.x += movementY * sensitivity * invert;
        
        const PI_2 = Math.PI / 2;
        viewRotation.current.x = Math.max(-PI_2 + 0.01, Math.min(PI_2 - 0.01, viewRotation.current.x));
    };
    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, [isLocked]); // Removed camera dependency as we don't mutate it here anymore

  // Spawn Logic
  useEffect(() => {
      // Use direct state access for initial spawn check to ensure we have data if it exists
      const currentBlocks = useStore.getState().blocks;
      const spawnX = 0;
      const spawnZ = 0;
      for (let y = 60; y >= -10; y--) {
          const type = getBlock(spawnX, y, spawnZ, currentBlocks);
          if (type !== BlockType.air && type !== BlockType.water) {
              playerPos.current.set(spawnX, y + 0.5 + PLAYER_HEIGHT + 0.5, spawnZ);
              velocity.current.set(0, 0, 0);
              isInitialized.current = true;
              return;
          }
      }
      playerPos.current.set(0, 30, 0);
      isInitialized.current = true;
  }, []); 

  // Interaction Handlers
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!isLocked) return;
      if (useStore.getState().isInventoryOpen) return;

      if (e.button === 0) {
          isMining.current = true;
          isFirstBreak.current = true;
          if (useStore.getState().cameraMode === 0) {
              modelRef.current.swingTrigger = Date.now();
          }
      }
      if (e.button === 2) {
          // Place Block
          const state = useStore.getState();
          const currentBlocks = state.blocks;
          const rot = new Vector3(viewRotation.current.x, viewRotation.current.y, 0);
          // Convert viewRotation to Euler equivalent for direction calculation
          // viewRotation.x is pitch (X axis), viewRotation.y is yaw (Y axis)
          const dir = new Vector3(0, 0, -1);
          dir.applyAxisAngle(new Vector3(1, 0, 0), viewRotation.current.x);
          dir.applyAxisAngle(new Vector3(0, 1, 0), viewRotation.current.y);
          
          const hit = raycast(currentBlocks, playerPos.current, dir, 5);
          
          if (hit) {
              const invItem = state.inventory[state.activeHotbarSlot];
              if (invItem && invItem.count > 0) {
                   const nx = hit.x + hit.normal.x;
                   const ny = hit.y + hit.normal.y;
                   const nz = hit.z + hit.normal.z;
                   
                   // Collision check to prevent self-placement
                   const pp = playerPos.current;
                   const epsilon = 0.01;
                   const w = PLAYER_WIDTH / 2;
                   const pMinX = pp.x - w + epsilon;
                   const pMaxX = pp.x + w - epsilon;
                   const pMinY = pp.y - currentHeight.current + epsilon;
                   const pMaxY = pp.y - epsilon;
                   const pMinZ = pp.z - w + epsilon;
                   const pMaxZ = pp.z + w - epsilon;
                   const bMinX = nx - 0.5;
                   const bMaxX = nx + 0.5;
                   const bMinY = ny - 0.5;
                   const bMaxY = ny + 0.5;
                   const bMinZ = nz - 0.5;
                   const bMaxZ = nz + 0.5;

                   if (!(pMinX < bMaxX && pMaxX > bMinX && pMinY < bMaxY && pMaxY > bMinY && pMinZ < bMaxZ && pMaxZ > bMinZ)) {
                        addBlock(nx, ny, nz, invItem.type);
                        if (state.gamemode !== 'creative') {
                            removeFromHand(1);
                        }
                        if (state.cameraMode === 0) {
                            modelRef.current.swingTrigger = Date.now();
                        }
                   }
              }
          }
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
            isMining.current = false;
            miningTarget.current = null;
            miningProgress.current = 0;
            isFirstBreak.current = true;
        }
    };
    
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isLocked, camera, addBlock, removeFromHand]);

  useFrame((state, delta) => {
    if (!isInitialized.current) return;

    // Regen Logic
    const storeState = useStore.getState();
    const currentHealth = storeState.health;
    const maxHealth = storeState.maxHealth;
    const lastDamageTime = storeState.lastDamageTime;
    
    if (currentHealth > 0 && currentHealth < maxHealth) {
        const now = Date.now();
        if (now - lastDamageTime > 3000) {
             if (now - lastRegenTime.current > 1000) {
                 heal(1);
                 lastRegenTime.current = now;
             }
        }
    }

    if (health <= 0) return; // Dead players tell no tales (and move no physics)
    
    // Always fetch fresh state inside useFrame to avoid stale closures
    const blocks = storeState.blocks;
    const drops = storeState.drops;
    
    const dt = Math.min(delta, 0.1);

    if (teleportRequest) {
        playerPos.current.set(teleportRequest.x, teleportRequest.y, teleportRequest.z);
        velocity.current.set(0, 0, 0);
        setTeleportRequest(null);
        fallDistance.current = 0;
    }

    // Mining Logic
    if (isMining.current && isLocked && !isInventoryOpen) {
        // Continuous swinging
        if (Date.now() - modelRef.current.swingTrigger > 250) {
            if (storeState.cameraMode === 0) {
                modelRef.current.swingTrigger = Date.now();
            }
        }
        
        const dir = new Vector3(0, 0, -1);
        dir.applyAxisAngle(new Vector3(1, 0, 0), viewRotation.current.x);
        dir.applyAxisAngle(new Vector3(0, 1, 0), viewRotation.current.y);
        
        const hit = raycast(blocks, playerPos.current, dir, 5);
        
        if (hit) {
            const hitKey = `${hit.x},${hit.y},${hit.z}`;
            const targetKey = miningTarget.current ? `${miningTarget.current.x},${miningTarget.current.y},${miningTarget.current.z}` : '';
            
            if (hitKey !== targetKey) {
                miningTarget.current = { x: hit.x, y: hit.y, z: hit.z };
                miningProgress.current = 0;
            } else {
                const type = getBlock(hit.x, hit.y, hit.z, blocks);
                
                const isCreative = gamemode === 'creative';
                let timeNeeded = MINING_TIMES[type] || 0.5;
                
                if (isCreative) {
                     // First click instant, continuous holding adds delay
                     if (isFirstBreak.current) {
                         timeNeeded = 0;
                     } else {
                         timeNeeded = 0.15; // 150ms delay between blocks in creative
                     }
                }
                
                miningProgress.current += dt;
                if (miningProgress.current >= timeNeeded) {
                    removeBlock(hit.x, hit.y, hit.z);
                    if (!isCreative) {
                        addDrop(type, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
                    } else {
                        isFirstBreak.current = false;
                    }
                    miningProgress.current = 0;
                    miningTarget.current = null;
                }
            }
        } else {
            miningTarget.current = null;
            miningProgress.current = 0;
        }
    } else {
        miningTarget.current = null;
        miningProgress.current = 0;
    }

    // Pickup Logic
    if (drops.length > 0) {
        for (const drop of drops) {
            const dx = playerPos.current.x - drop.position[0];
            const dy = (playerPos.current.y - currentHeight.current/2) - drop.position[1];
            const dz = playerPos.current.z - drop.position[2];
            const distSq = dx*dx + dy*dy + dz*dz;
            
            if (distSq < 2.5) { // 1.5m radius approx
                if (addToInventory(drop.type)) {
                    removeDrop(drop.id);
                }
            }
        }
    }

    // Highlight Block
    if (highlightMesh.current) {
        if (isLocked && !isInventoryOpen) {
            const dir = new Vector3(0, 0, -1);
            dir.applyAxisAngle(new Vector3(1, 0, 0), viewRotation.current.x);
            dir.applyAxisAngle(new Vector3(0, 1, 0), viewRotation.current.y);
            
            const hit = raycast(blocks, playerPos.current, dir, 5);
            if (hit) {
                highlightMesh.current.position.set(hit.x, hit.y, hit.z);
                highlightMesh.current.visible = true;
            } else {
                highlightMesh.current.visible = false;
            }
        } else {
            highlightMesh.current.visible = false;
        }
    }
    
    // Environment update
    const headBlock = getBlock(Math.floor(playerPos.current.x), Math.floor(playerPos.current.y), Math.floor(playerPos.current.z), blocks);
    const inWater = headBlock === BlockType.water;
    const { skyColor, fogColor } = getSkyState(gameTime);
    const fogDist = Math.max(30, (renderDistance * 16) - 16);

    if (inWater) {
        if (scene.fog) {
            (scene.fog as Fog).color.set(WATER_COLOR);
            (scene.fog as Fog).near = WATER_FOG_NEAR;
            (scene.fog as Fog).far = WATER_FOG_FAR;
        }
        if (scene.background instanceof Color) scene.background.set(WATER_COLOR);
    } else {
        if (scene.fog) {
            (scene.fog as Fog).color.copy(fogColor);
            (scene.fog as Fog).near = 10;
            (scene.fog as Fog).far = fogDist; 
        }
        if (scene.background instanceof Color) scene.background.copy(skyColor);
    }

    // Physics
    if (isLocked && !isChatOpen && !isInventoryOpen) {
        const inputForward = forward;
        const inputBackward = backward;
        const inputLeft = left;
        const inputRight = right;
        const inputJump = jump;
        const inputCrouch = crouch;

        const targetHeight = inputCrouch ? CROUCH_HEIGHT : PLAYER_HEIGHT;
        const heightStep = 10 * dt;

        if (currentHeight.current > targetHeight) {
            currentHeight.current = Math.max(targetHeight, currentHeight.current - heightStep);
            playerPos.current.y -= heightStep; 
        } else if (currentHeight.current < targetHeight) {
            const testY = playerPos.current.y + heightStep;
            const testPos = playerPos.current.clone();
            testPos.y += heightStep; 
            if (!checkBodyCollision(testPos, blocks, currentHeight.current + heightStep)) {
                currentHeight.current = Math.min(targetHeight, currentHeight.current + heightStep);
                playerPos.current.y += heightStep;
            }
        }

        const moveSpeed = isFlying ? flySpeed : (inputCrouch ? walkSpeed * 0.4 : walkSpeed);
        const direction = new Vector3(0, 0, 0);
        
        // Calculate forward/right based on viewRotation (logical look direction)
        const forwardDir = new Vector3(0, 0, -1);
        forwardDir.applyAxisAngle(new Vector3(0, 1, 0), viewRotation.current.y);
        forwardDir.normalize();
        
        const rightDir = new Vector3();
        rightDir.crossVectors(forwardDir, new Vector3(0, 1, 0)).normalize();

        if (inputForward) direction.add(forwardDir);
        if (inputBackward) direction.sub(forwardDir);
        if (inputRight) direction.add(rightDir);
        if (inputLeft) direction.sub(rightDir);

        modelRef.current.isMoving = direction.lengthSq() > 0;
        if (direction.lengthSq() > 0) direction.normalize().multiplyScalar(moveSpeed);
        
        const feetBlock = getBlock(Math.floor(playerPos.current.x), Math.floor(playerPos.current.y - 1), Math.floor(playerPos.current.z), blocks);
        const isSwimming = inWater || feetBlock === BlockType.water;

        if (isFlying) {
            velocity.current.y = 0;
            if (inputJump) velocity.current.y = flySpeed;
            if (inputCrouch) velocity.current.y = -flySpeed;
            fallDistance.current = 0;
        } else if (isSwimming) {
            velocity.current.y -= GRAVITY * dt * 0.2; 
            velocity.current.y *= 0.8; 
            if (inputJump) velocity.current.y = 3;
            if (inputCrouch) velocity.current.y = -3;
            fallDistance.current = 0;
        } else {
            velocity.current.y -= GRAVITY * dt;
            if (inputJump && onGround.current) {
                velocity.current.y = jumpHeight;
                onGround.current = false;
            }
            // Fall Damage Accumulation
            if (!onGround.current && velocity.current.y < 0) {
                fallDistance.current -= velocity.current.y * dt;
            }
        }

        const moveX = direction.x * dt;
        const moveZ = direction.z * dt;
        const moveY = velocity.current.y * dt;

        const dist = Math.sqrt(moveX*moveX + moveY*moveY + moveZ*moveZ);
        const steps = Math.ceil(dist * 5) || 1; 
        const stepX = moveX / steps;
        const stepZ = moveZ / steps;
        const stepY = moveY / steps;

        for (let i = 0; i < steps; i++) {
            const currentPos = playerPos.current.clone();
            
            playerPos.current.x += stepX;
            let collisionX = checkBodyCollision(playerPos.current, blocks, currentHeight.current);
            if (!collisionX && onGround.current && inputCrouch && !isSwimming && !isFlying) {
                if (!isSupported(playerPos.current, blocks, currentHeight.current)) collisionX = true; 
            }
            if (collisionX) playerPos.current.x = currentPos.x;
            
            playerPos.current.z += stepZ;
            let collisionZ = checkBodyCollision(playerPos.current, blocks, currentHeight.current);
            if (!collisionZ && onGround.current && inputCrouch && !isSwimming && !isFlying) {
                if (!isSupported(playerPos.current, blocks, currentHeight.current)) collisionZ = true;
            }
            if (collisionZ) playerPos.current.z = currentPos.z;

            const prevY = playerPos.current.y;
            playerPos.current.y += stepY;

            if (isFlying) {
                if (checkBodyCollision(playerPos.current, blocks, currentHeight.current)) playerPos.current.y = prevY;
            } else if (velocity.current.y <= 0 && !isSwimming) { 
                if (checkBodyCollision(playerPos.current, blocks, currentHeight.current)) {
                    // We hit the ground (or ceiling if falling immediately after jump)
                    const floorY = getCollisionY(playerPos.current, blocks, 'down', currentHeight.current);
                    
                    if (floorY !== null) {
                        const feetY = playerPos.current.y - currentHeight.current;
                        const floorTop = floorY + 0.5;
                        
                        // Valid floor collision check: feet must be close to the floor top
                        if (feetY < floorTop + 0.5) {
                            playerPos.current.y = floorTop + currentHeight.current;
                            velocity.current.y = 0;
                            // Apply Fall Damage
                            if (fallDistance.current > 3 && !isFlying && !isSwimming && gamemode === 'survival') {
                                const dmg = Math.floor(fallDistance.current - 3);
                                if (dmg > 0) takeDamage(dmg);
                            }
                            fallDistance.current = 0;
                            onGround.current = true;
                        } else {
                            // Collision detected but it's likely a ceiling hit from previous upward momentum
                            playerPos.current.y = prevY;
                            velocity.current.y = 0;
                        }
                    } else {
                        playerPos.current.y = prevY;
                        velocity.current.y = 0;
                        onGround.current = true;
                        fallDistance.current = 0;
                    }
                } else {
                     if (i === steps - 1) onGround.current = false;
                }
            } else {
                const ceilY = getCollisionY(playerPos.current, blocks, 'up', currentHeight.current);
                if (ceilY !== null) {
                    playerPos.current.y = (ceilY - 0.5) - 0.01; // Epsilon to get out of block
                    velocity.current.y = 0;
                } else if (checkBodyCollision(playerPos.current, blocks, currentHeight.current)) {
                    playerPos.current.y = prevY; 
                    velocity.current.y = 0;
                }
                if (i === steps - 1 && !isSwimming) onGround.current = false;
            }
        }
        
        if (playerPos.current.y < -30) {
            // Void damage
            if (playerPos.current.y < -40 && gamemode === 'survival') {
                takeDamage(5 * dt);
                // Death logic handled by store/UI
            }
        }
    } else {
        modelRef.current.isMoving = false;
    }

    // Body Rotation Logic
    const cameraYaw = viewRotation.current.y;
    let bodyYaw = bodyRotation.current;
    
    // Normalize angle difference helper
    const getAngleDiff = (a: number, b: number) => {
        return Math.atan2(Math.sin(a - b), Math.cos(a - b));
    };
    
    const diff = getAngleDiff(cameraYaw, bodyYaw);
    
    if (modelRef.current.isMoving) {
        // When moving, rotate body towards camera look direction smoothly
        bodyYaw += diff * 10 * dt; 
    } else {
        const limit = Math.PI / 3; // 60 degrees
        if (diff > limit) {
             bodyYaw = cameraYaw - limit;
        } else if (diff < -limit) {
             bodyYaw = cameraYaw + limit;
        }
    }
    
    bodyRotation.current = bodyYaw;

    // Apply View Rotation to Camera (with offsets for modes)
    if (cameraMode === 1) { // Third Person Back
        const dir = new Vector3(0, 0, 1); // Backwards
        dir.applyAxisAngle(new Vector3(1, 0, 0), viewRotation.current.x);
        dir.applyAxisAngle(new Vector3(0, 1, 0), viewRotation.current.y);
        dir.normalize();

        const hit = raycast(blocks, playerPos.current, dir, 4);
        let dist = 4;
        if (hit) {
            dist = Math.max(0.5, hit.dist - 0.2);
        }
        const targetPos = playerPos.current.clone().add(dir.multiplyScalar(dist));
        camera.position.copy(targetPos);
        camera.rotation.set(viewRotation.current.x, viewRotation.current.y, 0);
        
    } else if (cameraMode === 2) { // Third Person Front
        const dir = new Vector3(0, 0, -1); // Forwards (in front of player)
        dir.applyAxisAngle(new Vector3(1, 0, 0), viewRotation.current.x);
        dir.applyAxisAngle(new Vector3(0, 1, 0), viewRotation.current.y);
        dir.normalize();

        const hit = raycast(blocks, playerPos.current, dir, 4);
        let dist = 4;
        if (hit) {
            dist = Math.max(0.5, hit.dist - 0.2);
        }
        const targetPos = playerPos.current.clone().add(dir.multiplyScalar(dist));
        camera.position.copy(targetPos);
        
        // Look back at player
        // We want the camera to look opposite to viewRotation
        // viewRotation is where the player looks.
        // Camera should look at player.
        // So Yaw + PI, Pitch inverted?
        // Actually, just lookAt playerPos
        camera.lookAt(playerPos.current);
        
    } else { // First Person
        camera.position.copy(playerPos.current);
        camera.rotation.set(viewRotation.current.x, viewRotation.current.y, 0);
    }
    
    modelRef.current.position.copy(playerPos.current);
    modelRef.current.position.y -= currentHeight.current; 
    modelRef.current.rotationY = bodyYaw;
    modelRef.current.headYaw = getAngleDiff(viewRotation.current.y, bodyYaw);
    modelRef.current.headPitch = viewRotation.current.x;
  });

  return (
    <>
        <lineSegments ref={highlightMesh} geometry={selectionGeo} visible={false}>
            <lineBasicMaterial color="#000000" depthTest={true} />
        </lineSegments>
        {cameraMode !== 0 && (
            <PlayerModel playerRef={modelRef} />
        )}
    </>
  );
};
