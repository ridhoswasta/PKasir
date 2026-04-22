import React, { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';

export function SplashScreen({ onDone, duration = 1800 }: { onDone: () => void; duration?: number }) {
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setHiding(true), duration - 400);
    const done = setTimeout(onDone, duration);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [onDone, duration]);

  return (
    <div
      className={`absolute inset-0 z-[9999] flex flex-col items-center justify-center
        bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300
        transition-opacity duration-500 ${hiding ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center text-white">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-white/40 rounded-full animate-pulse" />
          <div className="relative bg-white/15 backdrop-blur-md rounded-3xl p-7 shadow-2xl ring-1 ring-white/30">
            <Coffee className="w-20 h-20 text-white drop-shadow-lg" strokeWidth={1.6} />
          </div>
        </div>
        <h1 className="mt-7 text-5xl font-extrabold tracking-tight drop-shadow-md">PKasir</h1>
        <p className="mt-2 text-white/90 text-sm tracking-wide uppercase">Point of Sale System</p>

        <div className="mt-10 w-48 h-1.5 bg-white/25 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full animate-[loadbar_1.6s_ease-in-out]"
               style={{ width: '100%', transformOrigin: 'left' }} />
        </div>
      </div>

      <div className="absolute bottom-6 text-white/80 text-xs">
        © {new Date().getFullYear()} PKasir
      </div>

      <style>{`
        @keyframes loadbar {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
