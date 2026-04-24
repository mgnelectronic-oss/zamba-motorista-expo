import { useEffect, useRef, useState } from 'react';
import { lerpHeadingDeg, shortestAngleDiffDeg } from '@/lib/navigation/routeBearing';

/**
 * Interpola o rumo em vários frames até convergir — rotação do carro sem saltos.
 */
export function useSmoothedNavigationHeading(targetDeg: number, alpha = 0.2) {
  const ref = useRef(targetDeg);
  const [out, setOut] = useState(targetDeg);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      ref.current = lerpHeadingDeg(ref.current, targetDeg, alpha);
      setOut(ref.current);
      if (Math.abs(shortestAngleDiffDeg(ref.current, targetDeg)) > 1.25) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [targetDeg, alpha]);

  return out;
}
