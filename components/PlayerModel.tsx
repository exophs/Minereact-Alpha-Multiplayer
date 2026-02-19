
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, TextureLoader, NearestFilter, SRGBColorSpace, MeshStandardMaterial } from 'three';
import { textures } from '../utils/textures';

interface PlayerModelProps {
    playerRef: React.MutableRefObject<{
        position: Vector3;
        rotationY: number;
        headPitch: number;
        headYaw: number;
        isMoving: boolean;
        swingTrigger: number;
    }>;
}

export const PlayerModel: React.FC<PlayerModelProps> = ({ playerRef }) => {
    const group = useRef<Group>(null);
    const headPivotRef = useRef<Group>(null);
    const leftArmRef = useRef<Group>(null);
    const rightArmRef = useRef<Group>(null);
    const leftLegRef = useRef<Group>(null);
    const rightLegRef = useRef<Group>(null);

    const lastSwingTime = useRef(0);
    const swingProgress = useRef(0);
    const isSwinging = useRef(false);

    const skinTex = useMemo(() => {
        const t = new TextureLoader().load(textures.skin);
        t.magFilter = NearestFilter;
        t.colorSpace = SRGBColorSpace;
        return t;
    }, []);

    const shirtTex = useMemo(() => {
        const t = new TextureLoader().load(textures.shirt);
        t.magFilter = NearestFilter;
        t.colorSpace = SRGBColorSpace;
        return t;
    }, []);

    const pantsTex = useMemo(() => {
        const t = new TextureLoader().load(textures.pants);
        t.magFilter = NearestFilter;
        t.colorSpace = SRGBColorSpace;
        return t;
    }, []);

    const skinMat = useMemo(() => new MeshStandardMaterial({ map: skinTex }), [skinTex]);
    const shirtMat = useMemo(() => new MeshStandardMaterial({ map: shirtTex }), [shirtTex]);
    const pantsMat = useMemo(() => new MeshStandardMaterial({ map: pantsTex }), [pantsTex]);

    useFrame((state, delta) => {
        if (!group.current) return;
        const { position, rotationY, headPitch, headYaw, isMoving, swingTrigger } = playerRef.current;

        // Sync Group Position and Rotation
        group.current.position.copy(position);
        group.current.rotation.y = rotationY;

        // Head Animation (Rotate pivot)
        if (headPivotRef.current) {
            headPivotRef.current.rotation.x = headPitch;
            headPivotRef.current.rotation.y = headYaw;
        }

        // Check for new swing trigger
        if (swingTrigger > lastSwingTime.current) {
            lastSwingTime.current = swingTrigger;
            isSwinging.current = true;
            swingProgress.current = 0;
        }

        // Swing Logic
        let swingAngle = 0;
        if (isSwinging.current) {
            swingProgress.current += delta * 15; // Swing speed
            if (swingProgress.current >= Math.PI) {
                isSwinging.current = false;
                swingProgress.current = 0;
            } else {
                // Positive rotation moves arm forward (-Z) from down (-Y) position
                swingAngle = Math.sin(swingProgress.current) * 2.0; 
            }
        }

        // Walk Animation
        const time = state.clock.elapsedTime * 10;
        const amp = 0.6;
        
        if (isMoving) {
            if (leftArmRef.current) leftArmRef.current.rotation.x = Math.sin(time + Math.PI) * amp;
            // Right arm mixes walk and swing. Swing overrides walk if active.
            if (rightArmRef.current) {
                if (isSwinging.current) {
                    rightArmRef.current.rotation.x = swingAngle;
                    rightArmRef.current.rotation.z = Math.sin(swingProgress.current) * 0.5; // Slight outwards during swing
                } else {
                    rightArmRef.current.rotation.x = Math.sin(time) * amp;
                    rightArmRef.current.rotation.z = 0;
                }
            }
            if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time) * amp;
            if (rightLegRef.current) rightLegRef.current.rotation.x = Math.sin(time + Math.PI) * amp;
        } else {
             // Idle breathing
             const breathe = Math.sin(state.clock.elapsedTime) * 0.05;
             if (leftArmRef.current) leftArmRef.current.rotation.x = breathe;
             
             if (rightArmRef.current) {
                if (isSwinging.current) {
                    rightArmRef.current.rotation.x = swingAngle;
                    rightArmRef.current.rotation.z = Math.sin(swingProgress.current) * 0.5;
                } else {
                    rightArmRef.current.rotation.x = -breathe;
                    rightArmRef.current.rotation.z = 0;
                }
             }

             if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
             if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
        }
    });

    return (
        <group ref={group}>
            {/* Head Pivot at Neck (y=1.5) */}
            <group ref={headPivotRef} position={[0, 1.5, 0]}>
                {/* Head mesh offset up by 0.25 (half height) to sit on pivot */}
                <mesh position={[0, 0.25, 0]} material={skinMat} castShadow>
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                </mesh>
            </group>

            {/* Body (0.5w x 0.75h x 0.25d), Center at 1.125 (0.75 + 0.375) */}
            <mesh position={[0, 1.125, 0]} material={shirtMat} castShadow>
                <boxGeometry args={[0.5, 0.75, 0.25]} />
            </mesh>

            {/* Arms - Pivot at shoulder (y=1.5) to align with top of torso */}
            <group ref={leftArmRef} position={[-0.375, 1.5, 0]}>
                {/* Arm box center offset (-0.375 is half height of 0.75) */}
                <mesh position={[0, -0.375, 0]} material={shirtMat} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>
            <group ref={rightArmRef} position={[0.375, 1.5, 0]}>
                <mesh position={[0, -0.375, 0]} material={shirtMat} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>

            {/* Legs - Pivot at hip (0.125, 0.75, 0) */}
            <group ref={leftLegRef} position={[-0.125, 0.75, 0]}>
                {/* Leg box center offset */}
                <mesh position={[0, -0.375, 0]} material={pantsMat} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>
            <group ref={rightLegRef} position={[0.125, 0.75, 0]}>
                <mesh position={[0, -0.375, 0]} material={pantsMat} castShadow>
                    <boxGeometry args={[0.25, 0.75, 0.25]} />
                </mesh>
            </group>
        </group>
    );
};
