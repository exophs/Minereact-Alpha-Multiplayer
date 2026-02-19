
import { Vector3, Color } from 'three';

export const getSkyState = (time: number) => {
    const normalizedTime = (time % 24000) / 24000;
    // 0 = Sunrise (East), 6000 = Noon (Up), 12000 = Sunset (West), 18000 = Midnight (Down)
    // We want 6000 (0.25) to be Up (Y=1).
    // sin(PI/2) = 1.
    // So theta = normalizedTime * 2 * PI.
    // 0.25 * 2PI = PI/2. Y=1. Correct.
    // 0 -> 0. Y=0, X=1. Sunrise East. Correct.
    
    const theta = normalizedTime * Math.PI * 2;
    const sunPos = new Vector3(Math.cos(theta), Math.sin(theta), 0.2); // 0.2 Z tilt
    sunPos.normalize();

    const dayColor = new Color('#B1D8FF');
    const nightColor = new Color('#050510');
    const sunsetColor = new Color('#FF8844');

    let skyColor = new Color();
    let sunIntensity = 0;
    let ambientIntensity = 0.2;

    const y = sunPos.y;

    if (y > 0.2) {
        // Full Day
        skyColor.copy(dayColor);
        sunIntensity = 1.0;
        ambientIntensity = 0.6;
    } else if (y < -0.2) {
        // Full Night
        skyColor.copy(nightColor);
        sunIntensity = 0;
        ambientIntensity = 0.15;
    } else {
        // Transition
        const t = (y + 0.2) / 0.4; 
        if (y > 0) {
             // Sunset/Sunrise -> Day
             skyColor.lerpColors(sunsetColor, dayColor, (y) / 0.2);
             sunIntensity = y / 0.2;
             ambientIntensity = 0.2 + (0.4 * (y/0.2));
        } else {
             // Night -> Sunset/Sunrise
             skyColor.lerpColors(nightColor, sunsetColor, (y + 0.2) / 0.2);
             sunIntensity = 0;
             ambientIntensity = 0.15 + (0.05 * ((y+0.2)/0.2));
        }
    }

    return {
        sunPos,
        skyColor,
        fogColor: skyColor,
        sunIntensity,
        ambientIntensity
    };
};
