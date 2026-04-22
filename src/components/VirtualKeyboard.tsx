import React, { useState } from 'react';
import { Delete, X, Space } from 'lucide-react';

interface VirtualKeyboardProps {
  mode: 'numeric' | 'text';
  visible: boolean;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onDismiss: () => void;
}

const prevent = (e: React.MouseEvent) => e.preventDefault();

function Key({ label, onAction, wide, variant, children }: {
  label?: string;
  onAction: () => void;
  wide?: boolean;
  variant?: 'default' | 'action' | 'danger';
  children?: React.ReactNode;
}) {
  const base = 'h-11 rounded-lg font-semibold text-sm select-none transition-colors active:scale-95 flex items-center justify-center';
  const colors = variant === 'action'
    ? 'bg-orange-600 hover:bg-orange-500 text-white'
    : variant === 'danger'
      ? 'bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white'
      : 'bg-slate-700 hover:bg-slate-600 text-slate-200';
  return (
    <button
      className={`${base} ${colors} ${wide ? 'col-span-2' : ''}`}
      onMouseDown={(e) => { prevent(e); onAction(); }}
    >
      {children || label}
    </button>
  );
}

function NumericPad({ onKeyPress, onBackspace, onClear }: Pick<VirtualKeyboardProps, 'onKeyPress' | 'onBackspace' | 'onClear'>) {
  const rows = [['1','2','3'],['4','5','6'],['7','8','9'],['C','0','←']];
  return (
    <div className="grid grid-cols-3 gap-1.5 w-64 mx-auto">
      {rows.flat().map((k) => {
        if (k === '←') return <React.Fragment key={k}><Key onAction={onBackspace} variant="danger"><Delete className="w-5 h-5" /></Key></React.Fragment>;
        if (k === 'C') return <React.Fragment key={k}><Key label="C" onAction={onClear} variant="danger" /></React.Fragment>;
        return <React.Fragment key={k}><Key label={k} onAction={() => onKeyPress(k)} /></React.Fragment>;
      })}
      <Key label="00" onAction={() => onKeyPress('00')} wide />
      <Key label="000" onAction={() => onKeyPress('000')} />
    </div>
  );
}

function QwertyPad({ onKeyPress, onBackspace, onClear }: Pick<VirtualKeyboardProps, 'onKeyPress' | 'onBackspace' | 'onClear'>) {
  const [shifted, setShifted] = useState(false);
  const row1 = 'QWERTYUIOP'.split('');
  const row2 = 'ASDFGHJKL'.split('');
  const row3 = 'ZXCVBNM'.split('');

  const display = (c: string) => shifted ? c : c.toLowerCase();
  const fire = (c: string) => onKeyPress(shifted ? c : c.toLowerCase());

  return (
    <div className="flex flex-col items-center gap-1.5 max-w-xl mx-auto">
      {/* Number row */}
      <div className="flex gap-1">
        {'1234567890'.split('').map(k => (
          <button key={k} className="h-9 w-9 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors active:scale-95" onMouseDown={(e) => { prevent(e); onKeyPress(k); }}>{k}</button>
        ))}
      </div>
      {/* Row 1 */}
      <div className="flex gap-1">
        {row1.map(c => (
          <button key={c} className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors active:scale-95" onMouseDown={(e) => { prevent(e); fire(c); }}>{display(c)}</button>
        ))}
      </div>
      {/* Row 2 */}
      <div className="flex gap-1">
        {row2.map(c => (
          <button key={c} className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors active:scale-95" onMouseDown={(e) => { prevent(e); fire(c); }}>{display(c)}</button>
        ))}
      </div>
      {/* Row 3 + shift/backspace */}
      <div className="flex gap-1">
        <button
          className={`h-10 w-14 rounded-lg text-xs font-bold transition-colors active:scale-95 ${shifted ? 'bg-orange-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-300'}`}
          onMouseDown={(e) => { prevent(e); setShifted(s => !s); }}
        >
          Shift
        </button>
        {row3.map(c => (
          <button key={c} className="h-10 w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors active:scale-95" onMouseDown={(e) => { prevent(e); fire(c); }}>{display(c)}</button>
        ))}
        <button className="h-10 w-14 rounded-lg bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white transition-colors active:scale-95 flex items-center justify-center" onMouseDown={(e) => { prevent(e); onBackspace(); }}>
          <Delete className="w-5 h-5" />
        </button>
      </div>
      {/* Bottom row */}
      <div className="flex gap-1">
        <button className="h-10 w-20 rounded-lg bg-slate-600 hover:bg-red-600 text-slate-300 hover:text-white text-xs font-semibold transition-colors active:scale-95" onMouseDown={(e) => { prevent(e); onClear(); }}>Hapus</button>
        <button className="h-10 flex-1 min-w-[200px] rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors active:scale-95 flex items-center justify-center" onMouseDown={(e) => { prevent(e); onKeyPress(' '); }}>
          <Space className="w-5 h-5" />
        </button>
        <button className="h-10 w-20 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors active:scale-95" onMouseDown={(e) => { prevent(e); onKeyPress('.'); }}>.</button>
      </div>
    </div>
  );
}

export function VirtualKeyboard({ mode, visible, onKeyPress, onBackspace, onClear, onDismiss }: VirtualKeyboardProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[60] bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 shadow-2xl transition-transform duration-200 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <div className="flex items-center justify-end px-4 pt-2 pb-1">
        <button
          className="h-6 w-6 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          onMouseDown={(e) => { prevent(e); onDismiss(); }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 pb-4">
        {mode === 'numeric'
          ? <NumericPad onKeyPress={onKeyPress} onBackspace={onBackspace} onClear={onClear} />
          : <QwertyPad onKeyPress={onKeyPress} onBackspace={onBackspace} onClear={onClear} />
        }
      </div>
    </div>
  );
}
