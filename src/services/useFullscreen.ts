/**
 * Issue #12: extracted shared fullscreen toggle hook.
 * Previously duplicated between LoginScreen.tsx and Layout.tsx.
 */
import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useFullscreen() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isFullscreen().then(setIsFullScreen);
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsFullScreen(await appWindow.isFullscreen());
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') appWindow.isFullscreen().then((fs) => { if (fs) appWindow.setFullscreen(false); });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullScreen = async () => {
    const fs = await appWindow.isFullscreen();
    if (!fs) {
      if (await appWindow.isMaximized()) await appWindow.unmaximize();
      await appWindow.setFullscreen(true);
    } else {
      await appWindow.setFullscreen(false);
    }
    setIsFullScreen(!fs);
  };

  return { isFullScreen, toggleFullScreen };
}
