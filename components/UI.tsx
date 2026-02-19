
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useStore, InventoryItem } from '../store';
import { BlockType, BlockMap } from '../types';
import { getTextureForBlock, textures } from '../utils/textures';
import { MenuButton } from './TitleScreen';
import { OptionsScreen } from './OptionsScreen';

interface UIProps {
  isLocked: boolean;
  onQuit: () => void;
}

// Helper to list all blocks for Creative Menu
const CREATIVE_ITEMS = Object.values(BlockType)
    .filter(v => typeof v === 'number' && v !== BlockType.air) as BlockType[];

const Heart: React.FC<{ type: 'full' | 'half' | 'empty' }> = ({ type }) => {
    const color = type === 'empty' ? '#333' : '#d00';
    return (
        <div className="w-4 h-4 mr-1 relative inline-block">
             <svg viewBox="0 0 9 9" className="w-full h-full">
                 <path d="M2 0 h5 v1 h2 v2 h-1 v1 h-1 v1 h-1 v1 h-1 v1 h-1 v1 h-1 v1 h-1 v1 h-1 v1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-1 h-1 v-2 h2 z" fill="none" stroke="black" strokeWidth="1" />
                 {type !== 'empty' && (
                    <path d="M2 1 h2 v1 h-2 z M5 1 h2 v1 h-2 z M1 2 h7 v2 h-1 v1 h-1 v1 h-1 v1 h-1 v1 h-1 v-1 h-1 v-1 h-1 v-2 z" fill={color} />
                 )}
                 {type === 'half' && (
                     <rect x="5" y="1" width="4" height="8" fill="black" fillOpacity="0.8" />
                 )}
             </svg>
        </div>
    );
};

// Crafting Recipes
const RECIPES: { inputs: (BlockType | null)[], result: { type: BlockType, count: number } }[] = [
    // 1 Wood -> 4 Planks
    { inputs: [BlockType.wood, null, null, null], result: { type: BlockType.planks, count: 4 } },
    { inputs: [null, BlockType.wood, null, null], result: { type: BlockType.planks, count: 4 } },
    { inputs: [null, null, BlockType.wood, null], result: { type: BlockType.planks, count: 4 } },
    { inputs: [null, null, null, BlockType.wood], result: { type: BlockType.planks, count: 4 } },
    
    // 2 Planks Vertical -> 4 Sticks
    { inputs: [BlockType.planks, null, BlockType.planks, null], result: { type: BlockType.stick, count: 4 } },
    { inputs: [null, BlockType.planks, null, BlockType.planks], result: { type: BlockType.stick, count: 4 } },

    // 4 Planks -> Crafting Table
    { inputs: [BlockType.planks, BlockType.planks, BlockType.planks, BlockType.planks], result: { type: BlockType.crafting_table, count: 1 } },

    // Coal + Stick -> 4 Torches
    { inputs: [BlockType.coal, null, BlockType.stick, null], result: { type: BlockType.torch, count: 4 } },
    { inputs: [null, BlockType.coal, null, BlockType.stick], result: { type: BlockType.torch, count: 4 } },
    
    // Cobble -> Stone (Simulated Furnace)
    { inputs: [BlockType.cobblestone, null, null, null], result: { type: BlockType.stone, count: 1 } },
    // Sand -> Glass
    { inputs: [BlockType.sand, null, null, null], result: { type: BlockType.glass, count: 1 } },
];

const checkRecipe = (grid: (InventoryItem | null)[]) => {
    // grid is array of 4
    for (const recipe of RECIPES) {
        let match = true;
        for (let i = 0; i < 4; i++) {
            if (recipe.inputs[i] === null) {
                if (grid[i] !== null) { match = false; break; }
            } else {
                if (grid[i] === null || grid[i]!.type !== recipe.inputs[i]) { match = false; break; }
            }
        }
        if (match) return recipe.result;
    }
    return null;
}

interface ItemSlotProps {
  item: InventoryItem | null;
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  label?: string;
  isCreative?: boolean;
}

const ItemSlot: React.FC<ItemSlotProps> = ({ item, onClick, onRightClick, label, isCreative }) => {
    const tex = item ? getTextureForBlock(item.type) : null;
    return (
      <div 
          className="w-10 h-10 bg-[#8b8b8b] border-2 border-t-[#373737] border-l-[#373737] border-r-[#fff] border-b-[#fff] flex items-center justify-center relative hover:bg-[#a0a0a0] active:bg-[#707070] select-none"
          onClick={onClick}
          onContextMenu={(e) => {
              e.preventDefault();
              if (onRightClick) onRightClick(e);
          }}
      >
          {label && <span className="absolute -top-4 text-xs text-gray-700 font-bold">{label}</span>}
          {tex && <img src={tex.map} className="w-8 h-8 rendering-pixelated object-contain" />}
          {item && (item.count > 1 || isCreative) && (
              <span className="absolute bottom-0 right-0 text-white text-[10px] font-bold leading-none px-0.5" style={{textShadow: '1px 1px 0 #000'}}>
                  {item.count > 1 ? item.count : ''}
              </span>
          )}
      </div>
    );
};

export const UI: React.FC<UIProps> = ({ isLocked, onQuit }) => {
  const inventory = useStore((state) => state.inventory);
  const activeSlot = useStore((state) => state.activeHotbarSlot);
  const setHotbarSlot = useStore((state) => state.setHotbarSlot);
  const setInventoryItem = useStore(state => state.setInventoryItem);
  const setInventoryOpen = useStore(state => state.setInventoryOpen);
  const isInventoryOpen = useStore(state => state.isInventoryOpen);
  
  const health = useStore((state) => state.health);
  const respawn = useStore((state) => state.respawn);
  const gamemode = useStore((state) => state.gamemode);
  
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  const chatMessages = useStore((state) => state.chatMessages);
  const addChatMessage = useStore((state) => state.addChatMessage);
  const username = useStore((state) => state.username);
  
  const [hasPlayed, setHasPlayed] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Crafting State
  const [craftingGrid, setCraftingGrid] = useState<(InventoryItem | null)[]>([null, null, null, null]);
  const [cursorItem, setCursorItem] = useState<InventoryItem | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const craftingResult = useMemo(() => checkRecipe(craftingGrid), [craftingGrid]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
        setCursorPos({ x: e.clientX, y: e.clientY });
    };
    if (isInventoryOpen) {
        window.addEventListener('mousemove', onMove);
    }
    return () => window.removeEventListener('mousemove', onMove);
  }, [isInventoryOpen]);

  useEffect(() => {
    if (isLocked) {
        setHasPlayed(true);
        setShowOptions(false);
        setChatOpen(false);
        setInventoryOpen(false);
    }
  }, [isLocked, setChatOpen, setInventoryOpen]);

  useEffect(() => {
    if (isChatOpen && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isChatOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Inventory Toggle
      if (e.code === 'KeyE' && !isChatOpen && !showOptions && health > 0) {
          if (isLocked) {
              document.exitPointerLock();
              setInventoryOpen(true);
          } else if (isInventoryOpen) {
              // Return items from grid to inventory
              if (cursorItem) {
                  useStore.getState().addToInventory(cursorItem.type, cursorItem.count);
                  setCursorItem(null);
              }
              craftingGrid.forEach(item => {
                  if(item) useStore.getState().addToInventory(item.type, item.count);
              });
              setCraftingGrid([null, null, null, null]);

              document.body.requestPointerLock();
              // Do not setInventoryOpen(false) here, wait for isLocked to change
          }
          return;
      }

      if (e.code === 'Escape') {
          if (showOptions) {
              setShowOptions(false);
              return;
          }
          if (isChatOpen) {
              document.body.requestPointerLock();
              return;
          }
          if (isInventoryOpen) {
             if (cursorItem) {
                useStore.getState().addToInventory(cursorItem.type, cursorItem.count);
                setCursorItem(null);
            }
            craftingGrid.forEach(item => {
                if(item) useStore.getState().addToInventory(item.type, item.count);
            });
            setCraftingGrid([null, null, null, null]);

             document.body.requestPointerLock();
             // Do not setInventoryOpen(false) here, wait for isLocked to change
             return;
          }
          if (!isLocked && hasPlayed && !isChatOpen && health > 0) {
              document.body.requestPointerLock();
              return;
          }
          if (isLocked) {
              document.exitPointerLock();
              return;
          }
          return;
      }

      if (showOptions || isInventoryOpen || health <= 0) return;

      if ((e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide') && isLocked && !isChatOpen) {
          e.preventDefault();
          setChatOpen(true);
          setChatInput('/');
          setHistoryIndex(-1);
          document.exitPointerLock();
          return;
      }

      if (e.code === 'KeyT' && isLocked && !isChatOpen) {
          e.preventDefault();
          setChatOpen(true);
          setChatInput('');
          setHistoryIndex(-1);
          document.exitPointerLock();
          return;
      }
      
      if (isChatOpen) {
          if (e.code === 'ArrowUp') {
              e.preventDefault();
              if (history.length === 0) return;
              let newIndex = historyIndex;
              if (newIndex === -1) {
                  newIndex = history.length - 1;
              } else {
                  newIndex = Math.max(0, newIndex - 1);
              }
              setHistoryIndex(newIndex);
              setChatInput(history[newIndex]);
          } else if (e.code === 'ArrowDown') {
              e.preventDefault();
              if (historyIndex === -1) return;
              let newIndex = historyIndex + 1;
              if (newIndex >= history.length) {
                  setHistoryIndex(-1);
                  setChatInput('');
              } else {
                  setHistoryIndex(newIndex);
                  setChatInput(history[newIndex]);
              }
          }
          return;
      }

      if (isLocked && !isChatOpen && e.key >= '1' && e.key <= '9') {
        setHotbarSlot(parseInt(e.key) - 1);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (showOptions || !isLocked || isChatOpen || isInventoryOpen || health <= 0) return;
      const direction = Math.sign(e.deltaY);
      if (direction === 0) return;
      let newSlot = activeSlot + direction;
      if (newSlot < 0) newSlot = 8;
      if (newSlot > 8) newSlot = 0;
      setHotbarSlot(newSlot);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [setHotbarSlot, showOptions, isLocked, isChatOpen, setChatOpen, history, historyIndex, hasPlayed, activeSlot, isInventoryOpen, setInventoryOpen, cursorItem, craftingGrid, health]);

  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = chatInput.trim();
      if (trimmed) {
          setHistory(prev => [...prev, trimmed]);
          setHistoryIndex(-1);
          if (trimmed.startsWith('/')) {
              const args = trimmed.slice(1).split(' ');
              const command = args[0].toLowerCase();
              if (command === 'help') {
                  addChatMessage('Commands: /tp <x> <y> <z>, /give <block> [count], /time set <day|night>, /gamemode <s|c>, /heal');
              } else if (command === 'clear') {
                  useStore.getState().clearChatMessages();
              } else if (command === 'gamemode' || command === 'gm') {
                  const mode = args[1]?.toLowerCase();
                  if (mode === '1' || mode === 'c' || mode === 'creative') {
                      useStore.getState().setGamemode('creative');
                      addChatMessage('Set gamemode to Creative');
                  } else if (mode === '0' || mode === 's' || mode === 'survival') {
                      useStore.getState().setGamemode('survival');
                      addChatMessage('Set gamemode to Survival');
                  } else {
                      addChatMessage('Usage: /gamemode <survival|creative>');
                  }
              } else if (command === 'heal') {
                  useStore.getState().heal(20);
                  addChatMessage('Restored health');
              } else if (command === 'tp') {
                   if (args.length === 4) {
                       const x = Number(args[1]);
                       const y = Number(args[2]);
                       const z = Number(args[3]);
                       if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                           useStore.getState().setTeleportRequest({x, y, z});
                           addChatMessage(`Teleported to ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`);
                       } else {
                           addChatMessage('Invalid coordinates');
                       }
                   } else {
                       addChatMessage('Usage: /tp <x> <y> <z>');
                   }
              } else if (command === 'time' || (command === 'set' && args[1] === 'time')) {
                  const valArg = command === 'time' ? args[2] : args[2];
                  let timeVal = -1;
                  switch(valArg?.toLowerCase()) {
                      case 'day': timeVal = 1000; break;
                      case 'noon': timeVal = 6000; break;
                      case 'sunset': timeVal = 12000; break;
                      case 'night': timeVal = 13000; break;
                      case 'midnight': timeVal = 18000; break;
                      case 'sunrise': timeVal = 0; break;
                      default: 
                          const parsed = parseInt(valArg);
                          if (!isNaN(parsed)) timeVal = parsed;
                          break;
                  }
                  if (timeVal !== -1) {
                      useStore.getState().setGameTime(timeVal);
                      addChatMessage(`Time set to ${timeVal}`);
                  } else {
                      addChatMessage('Usage: /time set <day|night|value>');
                  }
              } else if (command === 'give') {
                  if (args.length >= 2) {
                       const blockName = args[1].toLowerCase();
                       const count = args[2] ? parseInt(args[2]) : 64;
                       let found: BlockType | null = null;
                       const keys = Object.keys(BlockType).filter(k => isNaN(Number(k)));
                       for (const k of keys) {
                           if (k.toLowerCase() === blockName) {
                               found = BlockType[k as keyof typeof BlockType];
                               break;
                           }
                       }
                       if (found !== null) {
                           useStore.getState().addToInventory(found, count);
                           addChatMessage(`Gave ${count} ${blockName} to player`);
                       } else {
                           addChatMessage(`Block '${blockName}' not found`);
                       }
                  } else {
                      addChatMessage('Usage: /give <block> [count]');
                  }
              } else {
                  addChatMessage(`<${username}> ${chatInput}`);
              }
          } else {
              addChatMessage(`<${username}> ${chatInput}`);
          }
      }
      setChatInput('');
      document.body.requestPointerLock();
  };

  const resumeGame = (e: React.MouseEvent) => {
      e.stopPropagation();
      document.body.requestPointerLock();
  };

  const handleCreativeClick = (type: BlockType) => {
      // Pick up a stack of 64
      setCursorItem({ type, count: 64 });
  };

  const handleInventoryClick = (index: number) => {
      const item = inventory[index];
      
      if (!cursorItem) {
          // Pick up
          if (item) {
              setCursorItem(item);
              setInventoryItem(index, null);
          }
      } else {
          // Place or Swap
          if (!item) {
              setInventoryItem(index, cursorItem);
              setCursorItem(null);
          } else {
              if (item.type === cursorItem.type && item.count < 64) {
                  // Stack
                  const space = 64 - item.count;
                  const toAdd = Math.min(space, cursorItem.count);
                  setInventoryItem(index, { ...item, count: item.count + toAdd });
                  if (cursorItem.count - toAdd <= 0) setCursorItem(null);
                  else setCursorItem({ ...cursorItem, count: cursorItem.count - toAdd });
              } else {
                  // Swap
                  setCursorItem(item);
                  setInventoryItem(index, cursorItem);
              }
          }
      }
  };

  const handleInventoryRightClick = (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      const item = inventory[index];
      
      if (cursorItem) {
          // Holding item: Place one
          if (!item) {
              setInventoryItem(index, { ...cursorItem, count: 1 });
              if (cursorItem.count > 1) {
                  setCursorItem({ ...cursorItem, count: cursorItem.count - 1 });
              } else {
                  setCursorItem(null);
              }
          } else if (item.type === cursorItem.type && item.count < 64) {
              setInventoryItem(index, { ...item, count: item.count + 1 });
              if (cursorItem.count > 1) {
                  setCursorItem({ ...cursorItem, count: cursorItem.count - 1 });
              } else {
                  setCursorItem(null);
              }
          } else {
             // Different item: Swap
             setInventoryItem(index, cursorItem);
             setCursorItem(item);
          }
      } else {
          // Empty hand: Split stack
          if (item) {
              const take = Math.ceil(item.count / 2);
              const leave = item.count - take;
              setCursorItem({ ...item, count: take });
              if (leave > 0) {
                  setInventoryItem(index, { ...item, count: leave });
              } else {
                  setInventoryItem(index, null);
              }
          }
      }
  };

  const handleCraftingClick = (index: number) => {
      const item = craftingGrid[index];
      if (!cursorItem) {
          if (item) {
              setCursorItem(item);
              const newGrid = [...craftingGrid];
              newGrid[index] = null;
              setCraftingGrid(newGrid);
          }
      } else {
          if (!item) {
              const newGrid = [...craftingGrid];
              newGrid[index] = cursorItem;
              setCraftingGrid(newGrid);
              setCursorItem(null);
          } else {
               if (item.type === cursorItem.type && item.count < 64) {
                  const space = 64 - item.count;
                  const toAdd = Math.min(space, cursorItem.count);
                  const newGrid = [...craftingGrid];
                  newGrid[index] = { ...item, count: item.count + toAdd };
                  setCraftingGrid(newGrid);
                  if (cursorItem.count - toAdd <= 0) setCursorItem(null);
                  else setCursorItem({ ...cursorItem, count: cursorItem.count - toAdd });
               } else {
                   const newGrid = [...craftingGrid];
                   newGrid[index] = cursorItem;
                   setCraftingGrid(newGrid);
                   setCursorItem(item);
               }
          }
      }
  };

  const handleCraftingRightClick = (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      const item = craftingGrid[index];
      
      if (cursorItem) {
          if (!item) {
              const newGrid = [...craftingGrid];
              newGrid[index] = { ...cursorItem, count: 1 };
              setCraftingGrid(newGrid);
              if (cursorItem.count > 1) {
                  setCursorItem({ ...cursorItem, count: cursorItem.count - 1 });
              } else {
                  setCursorItem(null);
              }
          } else if (item.type === cursorItem.type && item.count < 64) {
              const newGrid = [...craftingGrid];
              newGrid[index] = { ...item, count: item.count + 1 };
              setCraftingGrid(newGrid);
              if (cursorItem.count > 1) {
                  setCursorItem({ ...cursorItem, count: cursorItem.count - 1 });
              } else {
                  setCursorItem(null);
              }
          } else {
              const newGrid = [...craftingGrid];
              newGrid[index] = cursorItem;
              setCraftingGrid(newGrid);
              setCursorItem(item);
          }
      } else {
          if (item) {
              const take = Math.ceil(item.count / 2);
              const leave = item.count - take;
              setCursorItem({ ...item, count: take });
              const newGrid = [...craftingGrid];
              if (leave > 0) {
                  newGrid[index] = { ...item, count: leave };
              } else {
                  newGrid[index] = null;
              }
              setCraftingGrid(newGrid);
          }
      }
  };

  const handleResultClick = () => {
      if (craftingResult) {
          if (!cursorItem) {
              setCursorItem(craftingResult);
              // Consume ingredients
              const newGrid = craftingGrid.map(i => {
                  if (i) {
                      if (i.count > 1) return { ...i, count: i.count - 1 };
                      return null;
                  }
                  return null;
              });
              setCraftingGrid(newGrid);
          } else if (cursorItem.type === craftingResult.type && cursorItem.count + craftingResult.count <= 64) {
               setCursorItem({ ...cursorItem, count: cursorItem.count + craftingResult.count });
               // Consume
               const newGrid = craftingGrid.map(i => {
                  if (i) {
                      if (i.count > 1) return { ...i, count: i.count - 1 };
                      return null;
                  }
                  return null;
              });
              setCraftingGrid(newGrid);
          }
      }
  };

  if (showOptions) {
      return <OptionsScreen onBack={() => setShowOptions(false)} isOverlay={true} />;
  }

  // Death Screen
  if (health <= 0) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#4a0e0e]/80 pointer-events-auto z-50">
             <h1 className="text-5xl font-bold text-white mb-2" style={{textShadow: '2px 2px 0 #000'}}>Game Over!</h1>
             <p className="text-xl text-yellow-300 mb-8" style={{textShadow: '1px 1px 0 #000'}}>Score: &e0</p>
             <MenuButton onClick={() => {
                 respawn();
                 document.body.requestPointerLock();
             }}>Respawn</MenuButton>
             <MenuButton onClick={onQuit}>Title screen</MenuButton>
        </div>
      );
  }

  // Calculate hearts
  const fullHearts = Math.floor(health / 2);
  const halfHearts = health % 2;
  const emptyHearts = 10 - fullHearts - halfHearts;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-4 text-white z-10">
      <style>
        {`
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; }
            }
            .chat-fade {
                animation: fadeOut 10s forwards;
            }
            .inv-bg {
                background: #c6c6c6;
                border: 2px solid #000;
                box-shadow: inset 2px 2px 0 #fff, inset -2px -2px 0 #555;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 12px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: #000;
                border-left: 1px solid #888;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #888;
                border: 1px solid #fff;
            }
        `}
      </style>
      
      {!isLocked && !hasPlayed && (
        <div 
            className="absolute top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center flex-col pointer-events-auto z-50 cursor-pointer"
            onClick={resumeGame}
        >
          <h1 className="text-4xl font-bold mb-4 text-shadow">MineReact Alpha</h1>
          <p className="mb-8 text-lg">Click anywhere to start playing</p>
          <div className="bg-gray-800 p-4 rounded text-sm text-gray-300 shadow-lg border border-gray-600">
             <p>W, A, S, D - Move</p>
             <p>SPACE - Jump</p>
             <p>Double SPACE - Toggle Fly (Creative)</p>
             <p>Ctrl - Crouch</p>
             <p>E - Inventory & Crafting</p>
             <p>Left Click - Mine Block (Hold)</p>
             <p>Right Click - Place Block</p>
             <p>1-9 - Select Item</p>
             <p>Scroll - Cycle Item</p>
             <p>T - Chat</p>
          </div>
        </div>
      )}

      {/* Inventory Screen */}
      {isInventoryOpen && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-auto z-40">
              <div className="inv-bg p-4 flex flex-col text-black max-h-[90vh]">
                  {gamemode === 'survival' ? (
                      <>
                        <h2 className="mb-2 font-bold text-gray-700">Crafting</h2>
                        {/* Crafting Area */}
                        <div className="flex items-center mb-6">
                            <div className="grid grid-cols-2 gap-1 mr-4">
                                {craftingGrid.map((item, i) => (
                                    <ItemSlot 
                                        key={i} 
                                        item={item} 
                                        onClick={() => handleCraftingClick(i)} 
                                        onRightClick={(e) => handleCraftingRightClick(i, e)}
                                    />
                                ))}
                            </div>
                            <div className="text-2xl text-gray-600 mr-4">→</div>
                            <ItemSlot item={craftingResult ? { type: craftingResult.type, count: craftingResult.count } : null} onClick={handleResultClick} />
                        </div>
                      </>
                  ) : (
                      <>
                        <h2 className="mb-2 font-bold text-gray-700">Creative Selection</h2>
                        <div className="grid grid-cols-9 gap-1 mb-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-1 bg-[#8b8b8b]/50 p-1 border border-gray-600">
                             {CREATIVE_ITEMS.map(type => (
                                 <ItemSlot 
                                    key={type} 
                                    item={{ type, count: 1 }} 
                                    onClick={() => handleCreativeClick(type)}
                                    isCreative={true}
                                 />
                             ))}
                        </div>
                      </>
                  )}

                  <h2 className="mb-1 font-bold text-gray-700">Inventory</h2>
                  {/* Main Inventory (9-35) */}
                  <div className="grid grid-cols-9 gap-1 mb-2">
                      {Array.from({ length: 27 }).map((_, i) => {
                          const slotIndex = i + 9;
                          return (
                              <ItemSlot 
                                key={slotIndex} 
                                item={inventory[slotIndex]} 
                                onClick={() => handleInventoryClick(slotIndex)} 
                                onRightClick={(e) => handleInventoryRightClick(slotIndex, e)}
                              />
                          );
                      })}
                  </div>

                  {/* Hotbar (0-8) */}
                  <div className="grid grid-cols-9 gap-1 mt-2 pt-2 border-t border-gray-500">
                       {Array.from({ length: 9 }).map((_, i) => (
                           <ItemSlot 
                            key={i} 
                            item={inventory[i]} 
                            onClick={() => handleInventoryClick(i)} 
                            onRightClick={(e) => handleInventoryRightClick(i, e)}
                           />
                       ))}
                  </div>
              </div>
          </div>
      )}

      {/* Cursor Item Drag */}
      {cursorItem && isInventoryOpen && (
          <div 
             className="fixed w-10 h-10 pointer-events-none z-50 flex items-center justify-center"
             style={{ left: cursorPos.x - 20, top: cursorPos.y - 20 }}
          >
              <img src={getTextureForBlock(cursorItem.type).map} className="w-8 h-8 rendering-pixelated" />
              <span className="absolute bottom-0 right-0 text-white text-[12px] font-bold leading-none" style={{textShadow: '1px 1px 0 #000'}}>
                  {cursorItem.count}
              </span>
          </div>
      )}

      {!isLocked && hasPlayed && !isChatOpen && !isInventoryOpen && (
         <div 
            className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col pointer-events-auto z-50"
            onClick={(e) => e.stopPropagation()} 
         >
             <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-white mb-2" style={{textShadow: '2px 2px 0 #3f3f3f'}}>Game menu</h2>
             </div>
             <MenuButton onClick={resumeGame}>Back to game</MenuButton>
             <MenuButton onClick={() => setShowOptions(true)}>Options...</MenuButton>
             <MenuButton onClick={onQuit}>Save and quit to title</MenuButton>
         </div>
      )}

      {(isLocked || isChatOpen || isInventoryOpen) && !isInventoryOpen && (
          <div className="flex flex-col items-center">
            {/* HUD Area */}
            <div className="flex flex-col items-start bg-transparent">
                {/* Hearts - Aligned left */}
                {gamemode === 'survival' && (
                    <div className="flex justify-start mb-1 h-4 pl-[6px]">
                        {Array.from({ length: fullHearts }).map((_, i) => <Heart key={`f${i}`} type="full" />)}
                        {Array.from({ length: halfHearts }).map((_, i) => <Heart key={`h${i}`} type="half" />)}
                        {Array.from({ length: emptyHearts }).map((_, i) => <Heart key={`e${i}`} type="empty" />)}
                    </div>
                )}

                {/* Hotbar */}
                <div className="flex justify-center gap-1 pointer-events-auto bg-[#111]/80 p-1 border-2 border-[#555] rounded-sm shadow-lg">
                    {Array.from({ length: 9 }).map((_, index) => {
                        const item = inventory[index];
                        const tex = item ? getTextureForBlock(item.type) : null;
                        const isActive = activeSlot === index;
                        
                        return (
                            <div
                                key={index}
                                className={`w-10 h-10 flex items-center justify-center relative select-none
                                    ${isActive ? 'border-[3px] border-white bg-white/10' : 'border border-[#333] bg-[#222]'}`}
                            >
                                {tex ? (
                                    <>
                                        <img src={tex.map} className="w-7 h-7 rendering-pixelated object-contain" alt={item ? BlockMap[item.type] : ''} />
                                        {item!.count > 1 && (
                                            <span className="absolute bottom-0.5 right-0.5 text-white text-[10px] font-bold leading-none px-0.5" style={{textShadow: '1px 1px 0 #000'}}>
                                                {item!.count}
                                            </span>
                                        )}
                                    </>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="text-center mt-4 text-yellow-400 font-bold text-shadow h-6 text-lg animate-pulse">
                {inventory[activeSlot] ? BlockMap[inventory[activeSlot]!.type] : ''}
            </div>
          </div>
      )}
      
      {(isChatOpen || chatMessages.length > 0) && (
          <div className={`absolute bottom-24 left-2 w-1/2 max-w-lg flex flex-col justify-end ${isChatOpen ? 'pointer-events-auto' : ''}`}>
              <div className="flex flex-col gap-1 mb-2 text-shadow-sm font-bold text-white drop-shadow-md max-h-[50vh] overflow-y-auto hide-scrollbar">
                  {chatMessages.slice(isChatOpen ? -20 : -10).map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`bg-black/30 p-1 px-2 rounded w-fit mb-1 ${!isChatOpen ? 'chat-fade' : ''}`}
                        style={{ opacity: isChatOpen ? 1 : undefined }}
                      >
                          {msg.text}
                      </div>
                  ))}
              </div>
              {isChatOpen && (
                  <form onSubmit={handleChatSubmit} className="w-full">
                      <input 
                        ref={inputRef}
                        type="text" 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        className="w-full bg-black/50 border border-gray-500 text-white px-2 py-1 outline-none"
                        placeholder=""
                      />
                  </form>
              )}
          </div>
      )}
    </div>
  );
};
