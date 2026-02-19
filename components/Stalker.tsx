
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, Mesh, MeshBasicMaterial, MathUtils } from 'three';
import { useStore } from '../store';
import { BlockType } from '../types';
import { getBlock } from '../utils/worldGen';

const STALKER_WIDTH = 0.6;
const STALKER_HEIGHT = 1.8;
const JUMP_FORCE = 6;
const MOVE_SPEED = 4.0; 

const checkCollision = (pos: Vector3, blocks: Record<string, BlockType>) => {
    const w = STALKER_WIDTH / 2;
    const epsilon = 0.05; 
    
    const minX = Math.floor(pos.x - w + epsilon);
    const maxX = Math.floor(pos.x + w - epsilon);
    const minZ = Math.floor(pos.z - w + epsilon);
    const maxZ = Math.floor(pos.z + w - epsilon);
    
    const minY = Math.floor(pos.y + 0.5);
    const maxY = Math.floor(pos.y + STALKER_HEIGHT - 0.1); 

    for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
            for (let y = minY; y <= maxY; y++) {
                if (getBlock(x, y, z, blocks) !== BlockType.air) return true;
            }
        }
    }
    return false;
};

const getFloorY = (x: number, y: number, z: number, blocks: Record<string, BlockType>) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    for (let iy = Math.floor(y); iy > -30; iy--) {
        if (getBlock(ix, iy, iz, blocks) !== BlockType.air) {
            return iy + 0.5;
        }
    }
    return -100;
};

export const Stalker: React.FC = () => {
    const { camera } = useThree();
    const blocks = useStore(state => state.blocks);
    const group = useRef<Group>(null);
    
    const headRef = useRef<Mesh>(null);
    const leftArmRef = useRef<Group>(null);
    const rightArmRef = useRef<Group>(null);
    const leftLegRef = useRef<Group>(null);
    const rightLegRef = useRef<Group>(null);

    const position = useRef(new Vector3(0, 0, 0));
    const isInitialized = useRef(false);
    
    useEffect(() => {
        const savedPos = useStore.getState().stalkerPosition;

        if (savedPos) {
            position.current.set(savedPos.x, savedPos.y, savedPos.z);
        } else {
            const angle = Math.random() * Math.PI * 2;
            const dist = 45;
            position.current.set(
                Math.cos(angle) * dist,
                60, 
                Math.sin(angle) * dist
            );
        }
        isInitialized.current = true;

        return () => {
            if (isInitialized.current) {
                useStore.getState().setStalkerPosition({
                    x: position.current.x,
                    y: position.current.y,
                    z: position.current.z
                });
            }
        };
    }, []);

    const velocity = useRef(new Vector3(0, 0, 0));
    const lastPos = useRef(new Vector3(0, 0, 0));
    const stuckCounter = useRef(0);
    
    const material = useMemo(() => new MeshBasicMaterial({ color: '#000000' }), []);

    useFrame((state, delta) => {
        if (!group.current || !isInitialized.current) return;
        
        const playerPos = camera.position;
        const myPos = position.current;
        const dt = Math.min(delta, 0.1);

        const dx = playerPos.x - myPos.x;
        const dz = playerPos.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        
        const angle = Math.atan2(dx, dz);
        let rotDiff = angle - group.current.rotation.y;
        while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
        while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
        group.current.rotation.y += rotDiff * 5 * dt;

        if (headRef.current) {
            const dy = (playerPos.y - 1.6) - (myPos.y + 1.6);
            const pitch = -Math.atan2(dy, dist);
            headRef.current.rotation.x = MathUtils.lerp(headRef.current.rotation.x, Math.max(-0.8, Math.min(0.8, pitch)), dt * 5);
        }

        let isMoving = false;
        const onGround = Math.abs(velocity.current.y) < 0.1 && myPos.y > -30;

        if (dist > 1.5) {
            isMoving = true;
            
            const nx = dx / dist;
            const nz = dz / dist;

            const moveStepX = nx * MOVE_SPEED * dt;
            const moveStepZ = nz * MOVE_SPEED * dt;

            let testPos = myPos.clone();
            testPos.x += moveStepX;
            
            if (!checkCollision(testPos, blocks)) {
                myPos.x += moveStepX;
            } else {
                if (onGround) {
                     const jumpTestPos = testPos.clone();
                     jumpTestPos.y += 1.1;
                     if (!checkCollision(jumpTestPos, blocks)) {
                         velocity.current.y = JUMP_FORCE;
                     }
                }
            }

            testPos = myPos.clone();
            testPos.z += moveStepZ;
            
            if (!checkCollision(testPos, blocks)) {
                myPos.z += moveStepZ;
            } else {
                 if (onGround) {
                     const jumpTestPos = testPos.clone();
                     jumpTestPos.y += 1.1;
                     if (!checkCollision(jumpTestPos, blocks)) {
                         velocity.current.y = JUMP_FORCE;
                     }
                }
            }
            
            const movedDist = myPos.distanceTo(lastPos.current);
            if (movedDist < 0.01 * dt * 60) { 
                stuckCounter.current++;
            } else {
                stuckCounter.current = Math.max(0, stuckCounter.current - 1);
            }
            
            if (stuckCounter.current > 30 && onGround) {
                velocity.current.y = JUMP_FORCE;
                stuckCounter.current = 0;
            }

            lastPos.current.copy(myPos);
        }

        velocity.current.y -= 20 * dt; 
        myPos.y += velocity.current.y * dt;

        const floorY = getFloorY(myPos.x, myPos.y + 0.5, myPos.z, blocks);
        if (myPos.y < floorY) {
            myPos.y = floorY;
            velocity.current.y = 0;
        }

        if (velocity.current.y > 0) {
             const headY = myPos.y + 1.8;
             if (getBlock(Math.floor(myPos.x), Math.floor(headY), Math.floor(myPos.z), blocks) !== BlockType.air) {
                 velocity.current.y = 0;
                 myPos.y = Math.floor(headY) - 1.8 - 0.01;
             }
        }
        
        if (myPos.y < -30) {
             myPos.set(playerPos.x + 20, 60, playerPos.z + 20); 
             velocity.current.set(0,0,0);
        }

        group.current.position.copy(myPos);

        if (isMoving) {
            const time = state.clock.elapsedTime * 10;
            const amp = 0.6;
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time + Math.PI) * amp;
            if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(time) * amp;
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time) * amp;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time + Math.PI) * amp;
        } else {
            const time = state.clock.elapsedTime;
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time) * 0.05;
            if (rightArmRef.current) rightArmRef.current.rotation.x = -Math.sin(time) * 0.05;
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        }
    });

    return (
        <group ref={group}>
            <mesh ref={headRef} position={[0, 1.75, 0]} material={material}>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
            </mesh>

            <mesh position={[0, 1.125, 0]} material={material}>
                <boxGeometry args={[0.5, 0.75, 0.25]} />
            </mesh>

            <group ref={leftArmRef} position={[-0.375, 1.5, 0]}>
                <mesh position={[0, -0.375, 0]} material={material}>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>
            <group ref={rightArmRef} position={[0.375, 1.5, 0]}>
                <mesh position={[0, -0.375, 0]} material={material}>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>

            <group ref={leftLegRef} position={[-0.125, 0.75, 0]}>
                <mesh position={[0, -0.375, 0]} material={material}>
                     <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>
            <group ref={rightLegRef} position={[0.125, 0.75, 0]}>
                <mesh position={[0, -0.375, 0]} material={material}>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>
        </group>
    );
};
