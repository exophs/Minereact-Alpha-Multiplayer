
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, TextureLoader, NearestFilter, SRGBColorSpace } from 'three';
import { useStore, DropData } from '../store';
import { BlockType } from '../types';
import { getTextureForBlock } from '../utils/textures';
import { getBlock } from '../utils/worldGen';

const DropMesh: React.FC<{ drop: DropData }> = ({ drop }) => {
    const meshRef = useRef<Mesh>(null);
    const { map } = useMemo(() => getTextureForBlock(drop.type), [drop.type]);
    const texture = useMemo(() => {
        const t = new TextureLoader().load(map);
        t.magFilter = NearestFilter;
        t.colorSpace = SRGBColorSpace;
        return t;
    }, [map]);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.set(drop.position[0], drop.position[1], drop.position[2]);
            // Bobbing and rotating
            meshRef.current.rotation.y += 0.02;
            const bobOffset = Math.sin(state.clock.elapsedTime * 3 + parseFloat(drop.id)) * 0.1;
            meshRef.current.position.y += bobOffset;
        }
    });

    return (
        <mesh ref={meshRef} castShadow>
            <boxGeometry args={[0.25, 0.25, 0.25]} />
            <meshStandardMaterial map={texture} />
        </mesh>
    );
};

export const Drops: React.FC = () => {
    const drops = useStore(state => state.drops); // Only for rendering components
    const removeDrop = useStore(state => state.removeDrop);

    useFrame((state, delta) => {
        // Use fresh state for physics to avoid closure staleness issues
        const storeState = useStore.getState();
        const currentDrops = storeState.drops;
        const currentBlocks = storeState.blocks;
        
        if (currentDrops.length === 0) return;
        
        const dt = Math.min(delta, 0.1);
        const radius = 0.125; // Half size of the drop (0.25 box)

        const isSolid = (x: number, y: number, z: number) => {
            const type = getBlock(Math.floor(x), Math.floor(y), Math.floor(z), currentBlocks);
            return type !== BlockType.air && type !== BlockType.water;
        };

        for (const drop of currentDrops) {
            // Drop physics
            drop.age += dt;
            if (drop.age > 300) { // Despawn after 5 minutes
                removeDrop(drop.id);
                continue;
            }

            drop.velocity[1] -= 18 * dt; // Gravity

            // 1. Y Axis Movement
            let nextY = drop.position[1] + drop.velocity[1] * dt;
            
            if (drop.velocity[1] > 0) {
                // Moving Up - Check Ceiling
                if (isSolid(drop.position[0], nextY + radius, drop.position[2])) {
                    drop.velocity[1] = 0;
                    // Snap to just below ceiling
                    nextY = Math.floor(nextY + radius) - radius - 0.001;
                }
            } else {
                // Moving Down - Check Floor
                if (isSolid(drop.position[0], nextY - radius, drop.position[2])) {
                    drop.velocity[1] = 0;
                    drop.velocity[0] *= 0.6; // Ground Friction
                    drop.velocity[2] *= 0.6;
                    // Snap to just above floor
                    nextY = Math.floor(nextY - radius) + 1 + radius;
                }
            }
            drop.position[1] = nextY;

            // 2. X Axis Movement
            let nextX = drop.position[0] + drop.velocity[0] * dt;
            const xEdge = nextX + (drop.velocity[0] > 0 ? radius : -radius);
            
            if (isSolid(xEdge, drop.position[1], drop.position[2])) {
                drop.velocity[0] = 0;
                // Don't apply move
                nextX = drop.position[0];
            }
            drop.position[0] = nextX;

            // 3. Z Axis Movement
            let nextZ = drop.position[2] + drop.velocity[2] * dt;
            const zEdge = nextZ + (drop.velocity[2] > 0 ? radius : -radius);

            if (isSolid(drop.position[0], drop.position[1], zEdge)) {
                drop.velocity[2] = 0;
                // Don't apply move
                nextZ = drop.position[2];
            }
            drop.position[2] = nextZ;
        }
    });

    return (
        <group>
            {drops.map(drop => (
                <DropMesh key={drop.id} drop={drop} />
            ))}
        </group>
    );
};
