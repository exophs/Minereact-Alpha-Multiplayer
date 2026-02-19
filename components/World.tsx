
import React, { useMemo, useState, useRef, memo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Material, TextureLoader, NearestFilter, SRGBColorSpace, MeshStandardMaterial, BufferGeometry, Float32BufferAttribute } from 'three';
import { useStore } from '../store';
import { BlockType } from '../types';
import { getTextureForBlock } from '../utils/textures';
import { CHUNK_SIZE, CHUNK_MIN_Y, CHUNK_MAX_Y, generateChunkBuffer, getBufferBlock } from '../utils/worldGen';

const normals = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
];

const cubeCorners = [
  [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5],
  [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5],
  [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5],
  [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
];

const baseUVs = [0, 0, 1, 0, 0, 1, 1, 1];

const isTransparent = (type: BlockType) => {
  return type === BlockType.glass || type === BlockType.leaves || type === BlockType.air || type === BlockType.water;
};

const materialCache: Partial<Record<BlockType, Material[]>> = {};

const getMaterials = (type: BlockType): Material[] => {
    if (materialCache[type]) return materialCache[type]!;

    const { map, mapTop, mapSide, mapBottom } = getTextureForBlock(type);
    const loader = new TextureLoader();
    
    const loadTex = (src: string) => {
        const t = loader.load(src);
        t.magFilter = NearestFilter;
        t.minFilter = NearestFilter;
        t.colorSpace = SRGBColorSpace;
        // Enable anisotropic filtering for sharper textures at oblique angles
        t.anisotropy = 16;
        return t;
    };

    const matSide = new MeshStandardMaterial({ map: loadTex(mapSide || map) });
    const matTop = new MeshStandardMaterial({ map: loadTex(mapTop || map) });
    const matBottom = new MeshStandardMaterial({ map: loadTex(mapBottom || map) });

    if (type === BlockType.glass || type === BlockType.leaves || type === BlockType.water) {
        if (type === BlockType.leaves) {
            // Leaves: Use alpha test but render in opaque queue for correct depth/shadows
            matSide.transparent = false;
            matTop.transparent = false;
            matBottom.transparent = false;
            matSide.alphaTest = 0.5;
            matTop.alphaTest = 0.5;
            matBottom.alphaTest = 0.5;
        } else {
            // Water/Glass: True transparency
            matSide.transparent = true;
            matTop.transparent = true;
            matBottom.transparent = true;
            matSide.depthWrite = false; // Prevent occlusion issues with other transparents
            matTop.depthWrite = false;
            matBottom.depthWrite = false;
        }

        if (type === BlockType.water) {
            matSide.opacity = 0.7;
            matTop.opacity = 0.7;
            matBottom.opacity = 0.7;
        }
    }

    const materials = [matSide, matSide, matTop, matBottom, matSide, matSide];
    materialCache[type] = materials;
    return materials;
};

interface ChunkProps {
    cx: number;
    cz: number;
    modifiedBlocks: Record<string, BlockType>;
    version: number;
}

const Chunk: React.FC<ChunkProps> = memo(({ cx, cz, modifiedBlocks, version }) => {
    const buffer = useMemo(() => {
        return generateChunkBuffer(cx, cz, modifiedBlocks);
    }, [cx, cz, version, modifiedBlocks]);

    // Render opaque blocks first, then transparent ones to help with blending
    const opaqueTypes = [
        BlockType.dirt, BlockType.grass, BlockType.stone, 
        BlockType.wood, BlockType.leaves, BlockType.planks, 
        BlockType.cobblestone, BlockType.sand
    ];
    const transparentTypes = [
        BlockType.glass, BlockType.water
    ];

    return (
        <group>
            {opaqueTypes.map(type => (
                <ChunkTypeMesh 
                    key={type} 
                    cx={cx} 
                    cz={cz} 
                    type={type} 
                    buffer={buffer}
                />
            ))}
            {transparentTypes.map(type => (
                <ChunkTypeMesh 
                    key={type} 
                    cx={cx} 
                    cz={cz} 
                    type={type} 
                    buffer={buffer}
                />
            ))}
        </group>
    );
}, (prev, next) => {
    return prev.cx === next.cx && prev.cz === next.cz && prev.version === next.version;
});

const ChunkTypeMesh: React.FC<{cx:number, cz:number, type: BlockType, buffer: Uint8Array}> = memo(({cx, cz, type, buffer}) => {
    
    const materials = getMaterials(type);

    const geometry = useMemo(() => {
        const geo = new BufferGeometry();
        const vertArray: number[] = [];
        const normArray: number[] = [];
        const uvArray: number[] = [];
        const groupIndices: number[][] = [[], [], [], [], [], []];
        let vertexOffset = 0;
        
        const get = (lx: number, ly: number, lz: number) => getBufferBlock(buffer, lx, ly, lz);

        const addFace = (x: number, y: number, z: number, faceId: number) => {
            const corners = cubeCorners.slice(faceId * 4, faceId * 4 + 4);
            for (const corner of corners) vertArray.push(x + corner[0], y + corner[1], z + corner[2]);
            const n = normals[faceId];
            for (let i = 0; i < 4; i++) normArray.push(n[0], n[1], n[2]);
            uvArray.push(...baseUVs);
            const a = vertexOffset, b = vertexOffset + 1, c = vertexOffset + 2, d = vertexOffset + 3;
            groupIndices[faceId].push(a, b, c, c, b, d);
            vertexOffset += 4;
        };

        const startX = cx * CHUNK_SIZE;
        const startZ = cz * CHUNK_SIZE;

        let hasData = false;

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let y = CHUNK_MIN_Y; y < CHUNK_MAX_Y; y++) {
                    if (get(lx, y, lz) !== type) continue;
                    
                    hasData = true;

                    const wx = startX + lx;
                    const wz = startZ + lz;

                    // Improved culling logic
                    const shouldRenderFace = (nType: BlockType) => {
                        if (!isTransparent(nType)) return false; // Neighbor is solid, don't render
                        if (type === nType && isTransparent(type)) return false; // Same transparent type, cull interior
                        return true; 
                    };

                    if (shouldRenderFace(get(lx+1, y, lz))) addFace(wx,y,wz,0);
                    if (shouldRenderFace(get(lx-1, y, lz))) addFace(wx,y,wz,1);
                    if (shouldRenderFace(get(lx, y+1, lz))) addFace(wx,y,wz,2);
                    if (shouldRenderFace(get(lx, y-1, lz))) addFace(wx,y,wz,3);
                    if (shouldRenderFace(get(lx, y, lz+1))) addFace(wx,y,wz,4);
                    if (shouldRenderFace(get(lx, y, lz-1))) addFace(wx,y,wz,5);
                }
            }
        }

        if (!hasData) return null;

        const finalIndices: number[] = [];
        let indexOffset = 0;
        for (let matIndex = 0; matIndex < 6; matIndex++) {
            const indices = groupIndices[matIndex];
            if (indices.length > 0) {
                finalIndices.push(...indices);
                geo.addGroup(indexOffset, indices.length, matIndex);
                indexOffset += indices.length;
            }
        }
        geo.setAttribute('position', new Float32BufferAttribute(vertArray, 3));
        geo.setAttribute('normal', new Float32BufferAttribute(normArray, 3));
        geo.setAttribute('uv', new Float32BufferAttribute(uvArray, 2));
        geo.setIndex(finalIndices);
        geo.computeBoundingSphere();
        return geo;
    }, [cx, cz, type, buffer]);

    if (!geometry) return null;

    return (
        <mesh 
            geometry={geometry} 
            material={materials}
            castShadow 
            receiveShadow 
        />
    );
});


interface ChunkData {
    key: string;
    cx: number;
    cz: number;
}

export const World: React.FC = () => {
  const modifiedBlocks = useStore((state) => state.blocks);
  const chunkVersions = useStore((state) => state.chunkVersions);
  const renderDistance = useStore((state) => state.renderDistance);
  const { camera } = useThree();
  
  const [renderedChunks, setRenderedChunks] = useState<ChunkData[]>([]);
  
  useFrame(() => {
      const cx = Math.floor(camera.position.x / CHUNK_SIZE);
      const cz = Math.floor(camera.position.z / CHUNK_SIZE);
      
      const neededKeys = new Set<string>();
      const potentialChunks: {key:string, cx:number, cz:number, dist:number}[] = [];
      
      for (let x = cx - renderDistance; x <= cx + renderDistance; x++) {
          for (let z = cz - renderDistance; z <= cz + renderDistance; z++) {
              const dx = x - cx;
              const dz = z - cz;
              if (dx*dx + dz*dz > renderDistance*renderDistance) continue;

              const key = `${x},${z}`;
              neededKeys.add(key);
              potentialChunks.push({
                  key,
                  cx: x,
                  cz: z,
                  dist: dx*dx + dz*dz
              });
          }
      }

      // Filter out chunks that are too far
      const keptChunks = renderedChunks.filter(c => neededKeys.has(c.key));
      const keptKeys = new Set(keptChunks.map(c => c.key));

      // Find chunks to add
      const toAdd = potentialChunks
          .filter(c => !keptKeys.has(c.key))
          .sort((a, b) => a.dist - b.dist);
      
      // Load up to 2 chunks per frame to spread load
      if (toAdd.length > 0 || keptChunks.length !== renderedChunks.length) {
          const newChunks = [...keptChunks];
          const limit = 2; 
          for(let i=0; i < Math.min(toAdd.length, limit); i++) {
               newChunks.push({ key: toAdd[i].key, cx: toAdd[i].cx, cz: toAdd[i].cz });
          }
          setRenderedChunks(newChunks);
      }
  });

  return (
    <group>
        {renderedChunks.map(chunk => (
            <Chunk 
                key={chunk.key} 
                cx={chunk.cx} 
                cz={chunk.cz} 
                modifiedBlocks={modifiedBlocks}
                version={chunkVersions[chunk.key] || 0}
            />
        ))}
    </group>
  );
};
