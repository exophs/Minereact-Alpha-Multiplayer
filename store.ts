
import { create } from 'zustand';
import { BlockType } from './types';
import { getBlock } from './utils/worldGen';

const CHUNK_SIZE = 16;

const getAffectedChunkKeys = (x: number, z: number) => {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const keys = [`${cx},${cz}`];
    
    if (localX === 0) keys.push(`${cx - 1},${cz}`);
    if (localX === CHUNK_SIZE - 1) keys.push(`${cx + 1},${cz}`);
    if (localZ === 0) keys.push(`${cx},${cz - 1}`);
    if (localZ === CHUNK_SIZE - 1) keys.push(`${cx},${cz + 1}`);
    
    return keys;
}

const wakeNeighbors = (x: number, y: number, z: number, blocks: Record<string, BlockType>, activeFluids: Set<string>) => {
    const neighbors = [
        [x, y+1, z], // Up (important for water above to fall)
        [x+1, y, z], [x-1, y, z],
        [x, y, z+1], [x, y, z-1]
    ];
    
    const newActive = new Set(activeFluids);
    
    neighbors.forEach(([nx, ny, nz]) => {
        const type = getBlock(nx, ny, nz, blocks);
        if (type === BlockType.water) {
            newActive.add(`${nx},${ny},${nz}`);
        }
    });
    
    return newActive;
}

export interface ChatMessageData {
    id: number;
    text: string;
    timestamp: number;
}

export interface InventoryItem {
    type: BlockType;
    count: number;
}

export interface DropData {
    id: string;
    type: BlockType;
    position: [number, number, number];
    velocity: [number, number, number];
    age: number;
}

interface StoreState {
  blocks: Record<string, BlockType>; 
  chunkVersions: Record<string, number>; 
  activeFluids: Set<string>;
  
  addBlock: (x: number, y: number, z: number, type: BlockType) => void;
  removeBlock: (x: number, y: number, z: number) => void;
  setBlocks: (blocks: Record<string, BlockType>) => void;
  
  tickFluids: () => void;

  // Inventory & Survival
  gamemode: 'survival' | 'creative';
  setGamemode: (mode: 'survival' | 'creative') => void;

  health: number;
  maxHealth: number;
  lastDamageTime: number;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  respawn: () => void;
  
  inventory: (InventoryItem | null)[]; // 0-8 Hotbar, 9-35 Main Inventory
  activeHotbarSlot: number;
  setHotbarSlot: (index: number) => void;
  addToInventory: (type: BlockType, amount?: number) => boolean;
  removeFromHand: (amount?: number) => void;
  setInventoryItem: (index: number, item: InventoryItem | null) => void;

  isInventoryOpen: boolean;
  setInventoryOpen: (isOpen: boolean) => void;
  
  drops: DropData[];
  addDrop: (type: BlockType, x: number, y: number, z: number) => void;
  removeDrop: (id: string) => void;
  updateDrops: (drops: DropData[]) => void;

  fov: number;
  setFov: (fov: number) => void;
  renderDistance: number;
  setRenderDistance: (dist: number) => void;
  
  isStalkerEnabled: boolean;
  setStalkerEnabled: (enabled: boolean) => void;
  
  showFog: boolean;
  setShowFog: (enabled: boolean) => void;
  showShadows: boolean;
  setShowShadows: (enabled: boolean) => void;

  stalkerPosition: { x: number, y: number, z: number } | null;
  setStalkerPosition: (pos: { x: number, y: number, z: number }) => void;

  username: string;
  setUsername: (name: string) => void;

  isChatOpen: boolean;
  setChatOpen: (isOpen: boolean) => void;
  chatMessages: ChatMessageData[];
  addChatMessage: (msg: string) => void;
  clearChatMessages: () => void;

  teleportRequest: { x: number, y: number, z: number } | null;
  setTeleportRequest: (pos: { x: number, y: number, z: number } | null) => void;

  isFlying: boolean;
  toggleFlying: () => void;
  flySpeed: number;
  setFlySpeed: (speed: number) => void;
  walkSpeed: number;
  setWalkSpeed: (speed: number) => void;
  jumpHeight: number;
  setJumpHeight: (height: number) => void;

  gameTime: number;
  setGameTime: (time: number | ((prev: number) => number)) => void;

  viewBobbing: boolean;
  setViewBobbing: (val: boolean) => void;
  mouseSensitivity: number; // 0 to 200
  setMouseSensitivity: (val: number) => void;
  invertMouse: boolean;
  setInvertMouse: (val: boolean) => void;
  difficulty: number; // 0-3
  setDifficulty: (val: number) => void;

  cameraMode: number; // 0: First, 1: Third Back, 2: Third Front
  cycleCameraMode: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  blocks: {}, 
  chunkVersions: {},
  activeFluids: new Set<string>(),

  addBlock: (x, y, z, type) =>
    set((state) => {
      const keys = getAffectedChunkKeys(x, z);
      const newVersions = { ...state.chunkVersions };
      keys.forEach(k => newVersions[k] = (newVersions[k] || 0) + 1);
      
      let newActiveFluids = state.activeFluids;
      
      // If placing water, activate it
      if (type === BlockType.water) {
          newActiveFluids = new Set(state.activeFluids);
          newActiveFluids.add(`${x},${y},${z}`);
      } else {
          // If placing solid, neighbors might react
          newActiveFluids = wakeNeighbors(x, y, z, state.blocks, state.activeFluids);
      }

      return {
        blocks: { ...state.blocks, [`${x},${y},${z}`]: type },
        chunkVersions: newVersions,
        activeFluids: newActiveFluids
      };
    }),

  removeBlock: (x, y, z) =>
    set((state) => {
      const keys = getAffectedChunkKeys(x, z);
      const newVersions = { ...state.chunkVersions };
      keys.forEach(k => newVersions[k] = (newVersions[k] || 0) + 1);

      // When a block is removed, water neighbors might want to flow in
      const newActiveFluids = wakeNeighbors(x, y, z, state.blocks, state.activeFluids);

      return { 
          blocks: { ...state.blocks, [`${x},${y},${z}`]: BlockType.air },
          chunkVersions: newVersions,
          activeFluids: newActiveFluids
      };
    }),
  
  tickFluids: () => set((state) => {
      if (state.activeFluids.size === 0) return {};

      const nextActive = new Set<string>();
      const newBlocks = { ...state.blocks };
      const newVersions = { ...state.chunkVersions };
      let changed = false;
      
      const processList = Array.from(state.activeFluids) as string[];
      
      for (const key of processList) {
          const [x, y, z] = key.split(',').map(Number);
          
          // Verify source is still water
          if (getBlock(x, y, z, state.blocks) !== BlockType.water) continue;
          
          let flowed = false;
          
          // 1. Try Flow Down
          const targetDown = getBlock(x, y - 1, z, state.blocks);
          
          if (targetDown === BlockType.air) {
              const k = `${x},${y-1},${z}`;
              if (newBlocks[k] !== BlockType.water) {
                  newBlocks[k] = BlockType.water;
                  const cx = Math.floor(x / 16);
                  const cz = Math.floor(z / 16);
                  newVersions[`${cx},${cz}`] = (newVersions[`${cx},${cz}`] || 0) + 1;
                  changed = true;
                  
                  nextActive.add(k); // New block is active
                  flowed = true;
              }
          } else if (targetDown !== BlockType.water) {
              // 2. Hit solid/something else -> Flow Horizontal
              const neighbors = [[x+1, z], [x-1, z], [x, z+1], [x, z-1]];
              
              for (const [nx, nz] of neighbors) {
                  const nType = getBlock(nx, y, nz, state.blocks);
                  if (nType === BlockType.air) {
                      const k = `${nx},${y},${nz}`;
                      if (newBlocks[k] !== BlockType.water) {
                          newBlocks[k] = BlockType.water;
                          const cx = Math.floor(nx / 16);
                          const cz = Math.floor(nz / 16);
                          newVersions[`${cx},${cz}`] = (newVersions[`${cx},${cz}`] || 0) + 1;
                          changed = true;
                          
                          nextActive.add(k);
                          flowed = true;
                      }
                  }
              }
          }
          
          if (flowed || (targetDown !== BlockType.air && targetDown !== BlockType.water)) {
              if (flowed) nextActive.add(key);
          }
      }
      
      return {
          blocks: newBlocks,
          chunkVersions: newVersions,
          activeFluids: nextActive
      };
  }),

  setBlocks: (blocks) => set({ blocks }),
  
  // Survival State
  gamemode: 'survival',
  setGamemode: (mode) => set((state) => ({ 
      gamemode: mode,
      isFlying: mode === 'survival' ? false : state.isFlying,
      health: mode === 'creative' ? state.maxHealth : state.health
  })),

  health: 20,
  maxHealth: 20,
  lastDamageTime: 0,
  takeDamage: (amount) => set(state => {
      if (state.gamemode === 'creative') return {};
      return { 
          health: Math.max(0, state.health - amount),
          lastDamageTime: Date.now()
      };
  }),
  heal: (amount) => set(state => ({ health: Math.min(state.maxHealth, state.health + amount) })),
  respawn: () => set(state => {
      let spawnY = 30; // Default fallback
      // Find ground level at 0,0
      for (let y = 60; y > -10; y--) {
          const type = getBlock(0, y, 0, state.blocks);
          if (type !== BlockType.air && type !== BlockType.water) {
              spawnY = y + 2; 
              break;
          }
      }
      return {
          health: state.maxHealth,
          teleportRequest: { x: 0, y: spawnY, z: 0 }
      };
  }),

  inventory: new Array(36).fill(null), // 0-8 Hotbar, 9-35 Inventory
  activeHotbarSlot: 0,
  setHotbarSlot: (index) => set(state => {
      if (index >= 0 && index < 9) {
          return { activeHotbarSlot: index };
      }
      return {};
  }),
  addToInventory: (type, amount = 1) => {
      const state = get();
      const newInv = [...state.inventory];
      const maxStack = 64;
      
      // 1. Try to fill existing stacks in hotbar first, then inventory
      for (let i = 0; i < 36; i++) {
          const item = newInv[i];
          if (item && item.type === type && item.count < maxStack) {
              const add = Math.min(amount, maxStack - item.count);
              newInv[i] = { ...item, count: item.count + add };
              amount -= add;
              if (amount <= 0) break;
          }
      }
      // 2. Try empty slots (Hotbar first 0-8, then Main 9-35)
      if (amount > 0) {
          for (let i = 0; i < 36; i++) {
              if (!newInv[i]) {
                  const add = Math.min(amount, maxStack);
                  newInv[i] = { type, count: add };
                  amount -= add;
                  if (amount <= 0) break;
              }
          }
      }
      set({ inventory: newInv });
      return amount === 0; // Returns true if fully added
  },
  removeFromHand: (amount = 1) => set(state => {
      const newInv = [...state.inventory];
      const slot = state.activeHotbarSlot;
      const item = newInv[slot];
      if (item) {
          if (item.count <= amount) {
              newInv[slot] = null;
          } else {
              newInv[slot] = { ...item, count: item.count - amount };
          }
      }
      return { inventory: newInv };
  }),
  setInventoryItem: (index, item) => set(state => {
      const newInv = [...state.inventory];
      newInv[index] = item;
      return { inventory: newInv };
  }),

  isInventoryOpen: false,
  setInventoryOpen: (isOpen) => set({ isInventoryOpen: isOpen }),

  drops: [],
  addDrop: (type, x, y, z) => set(state => ({
      drops: [...state.drops, {
          id: Math.random().toString(36).substr(2, 9),
          type,
          position: [x, y, z],
          velocity: [(Math.random() - 0.5) * 4, 4, (Math.random() - 0.5) * 4],
          age: 0
      }]
  })),
  removeDrop: (id) => set(state => ({ drops: state.drops.filter(d => d.id !== id) })),
  updateDrops: (drops) => set({ drops }),

  fov: 75,
  setFov: (fov) => set({ fov }),
  renderDistance: 8, 
  setRenderDistance: (dist) => set({ renderDistance: dist }),

  isStalkerEnabled: false,
  setStalkerEnabled: (enabled) => set({ isStalkerEnabled: enabled }),

  showFog: true,
  setShowFog: (enabled) => set({ showFog: enabled }),
  showShadows: true,
  setShowShadows: (enabled) => set({ showShadows: enabled }),

  stalkerPosition: null,
  setStalkerPosition: (pos) => set({ stalkerPosition: pos }),

  username: "Player",
  setUsername: (name) => set({ username: name }),

  isChatOpen: false,
  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),
  chatMessages: [],
  addChatMessage: (msg) => set(state => ({ 
      chatMessages: [...state.chatMessages, { id: Math.random(), text: msg, timestamp: Date.now() }] 
  })),
  clearChatMessages: () => set({ chatMessages: [] }),

  teleportRequest: null,
  setTeleportRequest: (pos) => set({ teleportRequest: pos }),

  isFlying: false,
  toggleFlying: () => set(state => ({ isFlying: !state.isFlying })),
  flySpeed: 10,
  setFlySpeed: (speed) => set({ flySpeed: speed }),
  walkSpeed: 5,
  setWalkSpeed: (speed) => set({ walkSpeed: speed }),
  jumpHeight: 7, 
  setJumpHeight: (height) => set({ jumpHeight: height }),

  gameTime: 6000,
  setGameTime: (updater) => set(state => ({
      gameTime: typeof updater === 'function' ? updater(state.gameTime) : updater
  })),

  viewBobbing: true,
  setViewBobbing: (val) => set({ viewBobbing: val }),
  mouseSensitivity: 100,
  setMouseSensitivity: (val) => set({ mouseSensitivity: val }),
  invertMouse: false,
  setInvertMouse: (val) => set({ invertMouse: val }),
  difficulty: 2, // Normal
  setDifficulty: (val) => set({ difficulty: val }),

  cameraMode: 0,
  cycleCameraMode: () => set(state => ({ cameraMode: (state.cameraMode + 1) % 3 })),
}));
