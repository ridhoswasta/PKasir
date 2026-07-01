import { useState, useEffect } from 'react';
import { getCurrentWindow, type ResizeDirection } from '@tauri-apps/api/window';
import { Minus, X } from 'lucide-react';
import appIconUrl from '../../src-tauri/icons/icon.png';

const resizeHandles: Array<{
  direction: ResizeDirection;
  className: string;
}> = [
  { direction: 'North', className: 'top-0 left-2 right-2 h-1 cursor-n-resize' },
  { direction: 'South', className: 'bottom-0 left-2 right-2 h-1 cursor-s-resize' },
  { direction: 'West', className: 'left-0 top-2 bottom-2 w-1 cursor-w-resize' },
  { direction: 'East', className: 'right-0 top-2 bottom-2 w-1 cursor-e-resize' },
  { direction: 'NorthWest', className: 'top-0 left-0 h-3 w-3 cursor-nw-resize' },
  { direction: 'NorthEast', className: 'top-0 right-0 h-3 w-3 cursor-ne-resize' },
  { direction: 'SouthWest', className: 'bottom-0 left-0 h-3 w-3 cursor-sw-resize' },
  { direction: 'SouthEast', className: 'bottom-0 right-0 h-3 w-3 cursor-se-resize' },
];

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
    <>
      {!isMaximized && resizeHandles.map((handle) => (
        <div
          key={handle.direction}
          className={`fixed z-[60] ${handle.className}`}
          onMouseDown={(event) => {
            event.preventDefault();
            appWindow.startResizeDragging(handle.direction).catch(() => {});
          }}
        />
      ))}
      <div className="h-8 bg-background border-b border-border/60 flex items-center select-none shrink-0">
        {/* Drag region — fills available space */}
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 px-3 flex-1 h-full"
        >
          <img
            src={appIconUrl}
            alt=""
            className="w-4 h-4 object-contain pointer-events-none"
            draggable={false}
          />
          <span className="text-[11px] text-muted-foreground font-medium pointer-events-none tracking-wide">
            PKasir
          </span>
        </div>

        {/* Window controls */}
        <div className="flex h-full">
          <button
            onClick={() => appWindow.minimize()}
            aria-label="Minimalkan jendela"
            className="h-full w-[46px] inline-flex items-center justify-center text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            <Minus className="w-4 h-4" strokeWidth={1.2} />
          </button>

          <button
            onClick={() => appWindow.toggleMaximize()}
            aria-label={isMaximized ? 'Pulihkan jendela' : 'Maksimalkan jendela'}
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
            aria-label="Tutup jendela"
            className="h-full w-[46px] inline-flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
            tabIndex={-1}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </>
  );
}
