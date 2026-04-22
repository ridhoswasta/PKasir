import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Coffee, Minus, X } from 'lucide-react';

export function WindowTitlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    appWindow.isFullscreen().then(setIsFullScreen);
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
      setIsFullScreen(await appWindow.isFullscreen());
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  if (isFullScreen) return null;

  return (
    <div className="h-8 bg-background border-b border-border/60 flex items-center select-none shrink-0">
      {/* Drag region — fills available space */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 px-3 flex-1 h-full"
      >
        <Coffee className="w-3.5 h-3.5 text-orange-500 pointer-events-none" strokeWidth={2} />
        <span className="text-[11px] text-muted-foreground font-medium pointer-events-none tracking-wide">
          PKasir
        </span>
      </div>

      {/* Window controls */}
      <div className="flex h-full">
        <button
          onClick={() => appWindow.minimize()}
          className="h-full w-[46px] inline-flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          <Minus className="w-4 h-4" strokeWidth={1.2} />
        </button>

        <button
          onClick={() => appWindow.toggleMaximize()}
          className="h-full w-[46px] inline-flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {isMaximized ? (
            /* Restore — two overlapping rectangles */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1">
              <rect x="3" y="0.5" width="6.5" height="6.5" />
              <rect x="0.5" y="3" width="6.5" height="6.5" />
            </svg>
          ) : (
            /* Maximize — single rectangle */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>

        <button
          onClick={() => appWindow.close()}
          className="h-full w-[46px] inline-flex items-center justify-center text-muted-foreground hover:bg-red-600 hover:text-white transition-colors"
          tabIndex={-1}
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
