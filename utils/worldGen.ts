
import { BlockType } from '../types';
import { noise } from './noise';

const SEED = 1337;
const SCALE = 0.03;
const HEIGHT_SCALE = 10;
const WATER_LEVEL = 6;
const BIOME_SCALE = 0.005;

// Adjusted for bigger and more frequent caves
const CAVE_SCALE = 0.025;
const CAVE_THRESHOLD = 0.35;

export const CHUNK_SIZE = 16;
export const RENDER_DISTANCE = 5; 
export const CHUNK_MIN_Y = -32;
export const CHUNK_MAX_Y = 64;

const PAD = 1;
const BUFFER_WIDTH = CHUNK_SIZE + (PAD * 2);
const BUFFER_HEIGHT = (CHUNK_MAX_Y - CHUNK_MIN_Y) + (PAD * 2);
const BUFFER_SIZE = BUFFER_WIDTH * BUFFER_HEIGHT * BUFFER_WIDTH;

const random = (x: number, z: number) => {
    const sin = Math.sin(x * 12.9898 + z * 78.233 + SEED) * 43758.5453;
    return sin - Math.floor(sin);
}

const allowCave = (y: number, h: number, hasTreeRoot: boolean) => {
    // Avoid caves breaching near water bodies
    // If surface height is low (near water), keep a thicker crust
    if (h <= WATER_LEVEL + 2) {
        if (y > h - 5) return false;
    }

    // Avoid caves under trees to prevent floating trees
    if (hasTreeRoot) {
        if (y > h - 8) return false;
    }

    // Generic surface preservation
    if (y > h - 3) return false;

    return true;
}

export const getBlock = (x: number, y: number, z: number, modifiedBlocks: Record<string, BlockType>): BlockType => {
    const key = `${x},${y},${z}`;
    
    if (modifiedBlocks[key] !== undefined) {
        return modifiedBlocks[key];
    }
    
    // Bottom Bedrock Layer
    if (y <= CHUNK_MIN_Y) return BlockType.bedrock;

    const n = noise(x * SCALE, z * SCALE, SEED);
    const h = Math.floor((n + 1) * HEIGHT_SCALE);

    if (y < CHUNK_MIN_Y) return BlockType.air;

    if (y > h && y <= WATER_LEVEL) {
        return BlockType.water;
    }

    // Check for tree root at current X, Z to inform cave generation
    let hasTreeRoot = false;
    const biome = noise(x * BIOME_SCALE, z * BIOME_SCALE, SEED + 999);
    if (biome > -0.2 && h > WATER_LEVEL + 1) {
        if (random(x, z) > 0.98) {
            hasTreeRoot = true;
        }
    }

    if (y <= h) {
        if (allowCave(y, h, hasTreeRoot)) {
            const caveNoise = noise(x * CAVE_SCALE, y * CAVE_SCALE, z * CAVE_SCALE);
            const detail = noise(x * 0.1, y * 0.1, z * 0.1);
            if (caveNoise + (detail * 0.1) > CAVE_THRESHOLD) {
                return BlockType.air;
            }
        }

        if (y === h) {
            if (h <= WATER_LEVEL + 1) {
                return BlockType.sand;
            }
            return BlockType.grass;
        }
        if (y < h && y > h - 4) {
            if (h <= WATER_LEVEL + 1) return BlockType.sand;
            return BlockType.dirt;
        }
        if (y <= h - 4) {
            if (noise(x * 0.1, y * 0.1, z * 0.1) > 0.6) {
                return BlockType.cobblestone; 
            }
            return BlockType.stone;
        }
    }

    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            const checkX = x + dx;
            const checkZ = z + dz;
            
            const biomeVal = noise(checkX * BIOME_SCALE, checkZ * BIOME_SCALE, SEED + 999);
            const n2 = noise(checkX * SCALE, checkZ * SCALE, SEED);
            const groundY = Math.floor((n2 + 1) * HEIGHT_SCALE);
            
            if (biomeVal > -0.2 && groundY > WATER_LEVEL + 1) {
                if (random(checkX, checkZ) > 0.98) {
                    const treeBaseY = groundY + 1;
                    const treeHeight = 4 + Math.floor(random(checkX+1, checkZ+1) * 3);
                    
                    if (dx === 0 && dz === 0) {
                        if (y >= treeBaseY && y < treeBaseY + treeHeight) return BlockType.wood;
                    }
                    
                    const leavesStart = treeBaseY + treeHeight - 2;
                    const leavesEnd = treeBaseY + treeHeight + 1;
                    
                    if (y >= leavesStart && y <= leavesEnd) {
                         let radius = 2;
                         if (y === leavesEnd) radius = 1;
                         if (y === leavesEnd - 1) radius = 1;
                         
                         if (Math.abs(dx) <= radius && Math.abs(dz) <= radius) {
                             if (dx !== 0 || dz !== 0 || y >= treeBaseY + treeHeight) {
                                 return BlockType.leaves;
                             }
                         }
                    }
                }
            }
        }
    }

    return BlockType.air;
}

export const generateChunkBuffer = (cx: number, cz: number, modifiedBlocks: Record<string, BlockType>) => {
    const buffer = new Uint8Array(BUFFER_SIZE);
    
    const startX = (cx * CHUNK_SIZE) - PAD;
    const startY = CHUNK_MIN_Y - PAD;
    const startZ = (cz * CHUNK_SIZE) - PAD;

    let index = 0;
    
    for (let x = 0; x < BUFFER_WIDTH; x++) {
        for (let z = 0; z < BUFFER_WIDTH; z++) {
            const wx = startX + x;
            const wz = startZ + z;

            const n = noise(wx * SCALE, wz * SCALE, SEED);
            const h = Math.floor((n + 1) * HEIGHT_SCALE);

            const activeTrees = [];
            let hasTreeRoot = false;
            
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    const checkX = wx + dx;
                    const checkZ = wz + dz;
                    
                    const biome = noise(checkX * BIOME_SCALE, checkZ * BIOME_SCALE, SEED + 999);
                    
                    if (random(checkX, checkZ) > 0.98) {
                         const n2 = noise(checkX * SCALE, checkZ * SCALE, SEED);
                         const groundY = Math.floor((n2 + 1) * HEIGHT_SCALE);
                         
                         if (biome > -0.2 && groundY > WATER_LEVEL + 1) {
                             const treeBaseY = groundY + 1;
                             const treeHeight = 4 + Math.floor(random(checkX+1, checkZ+1) * 3);
                             activeTrees.push({ dx, dz, treeBaseY, treeHeight });
                             if (dx === 0 && dz === 0) {
                                 hasTreeRoot = true;
                             }
                         }
                    }
                }
            }

            for (let y = 0; y < BUFFER_HEIGHT; y++) {
                const wy = startY + y;
                const key = `${wx},${wy},${wz}`;
                
                if (modifiedBlocks[key] !== undefined) {
                    buffer[index++] = modifiedBlocks[key];
                    continue;
                }
                
                // Generate Bedrock Layer
                if (wy <= CHUNK_MIN_Y) {
                    buffer[index++] = BlockType.bedrock;
                    continue;
                }

                if (wy > h && wy <= WATER_LEVEL) {
                     buffer[index++] = BlockType.water;
                     continue;
                }

                if (wy <= h) {
                    let isCave = false;
                    
                    if (allowCave(wy, h, hasTreeRoot)) {
                        const caveNoise = noise(wx * CAVE_SCALE, wy * CAVE_SCALE, wz * CAVE_SCALE);
                        const detail = noise(wx * 0.1, wy * 0.1, wz * 0.1);
                        if (caveNoise + (detail * 0.1) > CAVE_THRESHOLD) {
                            isCave = true;
                        }
                    }

                    if (isCave) {
                        buffer[index++] = BlockType.air;
                    } else {
                        if (wy === h) {
                             if (h <= WATER_LEVEL + 1) buffer[index++] = BlockType.sand;
                             else buffer[index++] = BlockType.grass;
                        }
                        else if (wy > h - 4) {
                            if (h <= WATER_LEVEL + 1) buffer[index++] = BlockType.sand;
                            else buffer[index++] = BlockType.dirt;
                        }
                        else {
                             if (noise(wx * 0.1, wy * 0.1, wz * 0.1) > 0.6) buffer[index++] = BlockType.cobblestone;
                             else buffer[index++] = BlockType.stone;
                        }
                    }
                    continue;
                }

                let block = BlockType.air;
                
                if (activeTrees.length > 0) {
                    for (let i = 0; i < activeTrees.length; i++) {
                        const tree = activeTrees[i];
                        
                        if (tree.dx === 0 && tree.dz === 0) {
                            if (wy >= tree.treeBaseY && wy < tree.treeBaseY + tree.treeHeight) {
                                block = BlockType.wood;
                                break;
                            }
                        }
                        
                        const leavesStart = tree.treeBaseY + tree.treeHeight - 2;
                        const leavesEnd = tree.treeBaseY + tree.treeHeight + 1;
                        
                        if (wy >= leavesStart && wy <= leavesEnd) {
                             let radius = 2;
                             if (wy === leavesEnd) radius = 1;
                             if (wy === leavesEnd - 1) radius = 1;
                             
                             if (Math.abs(tree.dx) <= radius && Math.abs(tree.dz) <= radius) {
                                 if (block === BlockType.air) {
                                     block = BlockType.leaves;
                                 }
                             }
                        }
                    }
                }
                
                buffer[index++] = block;
            }
        }
    }
    
    return buffer;
}

export const getBufferBlock = (buffer: Uint8Array, lx: number, ly: number, lz: number): BlockType => {
    const bx = lx + PAD;
    const by = (ly - CHUNK_MIN_Y) + PAD;
    const bz = lz + PAD;
    
    if (bx < 0 || bx >= BUFFER_WIDTH || bz < 0 || bz >= BUFFER_WIDTH || by < 0 || by >= BUFFER_HEIGHT) {
        return BlockType.air;
    }

    const index = (bx * BUFFER_WIDTH * BUFFER_HEIGHT) + (bz * BUFFER_HEIGHT) + by;
    return buffer[index];
}
