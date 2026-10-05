import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';


export function useScreenOrientation(lock: ScreenOrientation.OrientationLock): void {
  useEffect(() => {
    ScreenOrientation.lockAsync(lock).catch(() => undefined);
    return () => {
      ScreenOrientation.unlockAsync().catch(() => undefined);
    };
  }, [lock]);
}