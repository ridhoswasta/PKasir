/**
 * QRCodeDisplay — renders a QR code from any text string onto a <canvas>.
 *
 * Requires the `qrcode` npm package (already in package.json).
 * Run `npm install` once to make the package available, then this component
 * works out of the box without any other changes.
 *
 * Usage:
 *   <QRCodeDisplay value="00020101..." size={256} />
 */

import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';

interface QRCodeDisplayProps {
  /** The string to encode — typically a dynamic QRIS string */
  value: string;
  /** Canvas size in pixels (default 256). Will be rendered as a square. */
  size?: number;
  /** Optional extra className for the wrapper div */
  className?: string;
}

export function QRCodeDisplay({ value, size = 256, className }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!value || !canvasRef.current) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    // Dynamic import — avoids compile-time TypeScript errors when @types/qrcode
    // is not yet installed. Falls back to an error state gracefully.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (import('qrcode') as Promise<any>)
      .then((QRCode) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        return QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });
      })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, [value, size]);

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: 'relative' }}
    >
      {/* Canvas — always mounted so the ref is valid on first paint */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          display: status === 'ok' ? 'block' : 'none',
          borderRadius: 8,
        }}
      />

      {/* Loading shimmer */}
      {status === 'loading' && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'qr-shimmer 1.2s infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <QrCode style={{ opacity: 0.25, width: size * 0.3, height: size * 0.3 }} />
          <style>{`
            @keyframes qr-shimmer {
              0%   { background-position: -200% 0; }
              100% { background-position:  200% 0; }
            }
          `}</style>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            border: '2px dashed #ccc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 12,
            textAlign: 'center',
            color: '#888',
          }}
        >
          <QrCode style={{ opacity: 0.4, width: size * 0.25, height: size * 0.25 }} />
          <span style={{ fontSize: 12 }}>
            Tidak dapat membuat QR Code.
            <br />
            Pastikan paket <code>qrcode</code> sudah terinstall.
          </span>
        </div>
      )}
    </div>
  );
}
