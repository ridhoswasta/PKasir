import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator as CalcIcon, Copy, Delete } from 'lucide-react';
import { toast } from 'sonner';

interface CalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Op = '+' | '-' | '×' | '÷';

const fmt = (n: number): string => {
  if (!isFinite(n)) return 'Error';
  const rounded = Math.round(n * 1e10) / 1e10;
  return rounded.toLocaleString('id-ID', { maximumFractionDigits: 10 });
};

export function CalculatorDialog({ open, onOpenChange }: CalculatorDialogProps) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [history, setHistory] = useState<string>('');

  const reset = () => {
    setDisplay('0');
    setPrev(null);
    setOp(null);
    setWaiting(false);
    setHistory('');
  };

  useEffect(() => { if (open) reset(); }, [open]);

  const compute = (a: number, b: number, operator: Op): number => {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
    }
  };

  const inputDigit = (d: string) => {
    if (waiting) {
      setDisplay(d);
      setWaiting(false);
    } else {
      setDisplay(display === '0' ? d : display + d);
    }
  };

  const inputDecimal = () => {
    if (waiting) {
      setDisplay('0.');
      setWaiting(false);
      return;
    }
    if (!display.includes('.')) setDisplay(display + '.');
  };

  const applyOperator = (nextOp: Op) => {
    const current = parseFloat(display);
    if (prev === null) {
      setPrev(current);
    } else if (op && !waiting) {
      const result = compute(prev, current, op);
      setDisplay(fmt(result));
      setPrev(result);
    }
    setOp(nextOp);
    setWaiting(true);
    setHistory(`${fmt(prev !== null && op && !waiting ? compute(prev, current, op) : current)} ${nextOp}`);
  };

  const evaluate = () => {
    if (prev === null || op === null) return;
    const current = parseFloat(display);
    const result = compute(prev, current, op);
    setHistory(`${fmt(prev)} ${op} ${fmt(current)} =`);
    setDisplay(fmt(result));
    setPrev(null);
    setOp(null);
    setWaiting(true);
  };

  const backspace = () => {
    if (waiting) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const percent = () => {
    const current = parseFloat(display);
    const result = prev !== null && op ? (prev * current) / 100 : current / 100;
    setDisplay(fmt(result));
    setWaiting(true);
  };

  const toggleSign = () => {
    if (display === '0') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display);
  };

  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(display.replace(/\./g, '').replace(/,/g, '.'));
      toast.success('Hasil disalin');
    } catch {
      toast.error('Gagal menyalin');
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); inputDigit(e.key); return; }
      if (e.key === '.' || e.key === ',') { e.preventDefault(); inputDecimal(); return; }
      if (e.key === '+') { e.preventDefault(); applyOperator('+'); return; }
      if (e.key === '-') { e.preventDefault(); applyOperator('-'); return; }
      if (e.key === '*' || e.key === 'x' || e.key === 'X') { e.preventDefault(); applyOperator('×'); return; }
      if (e.key === '/') { e.preventDefault(); applyOperator('÷'); return; }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluate(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
      if (e.key === 'Escape') { e.preventDefault(); reset(); return; }
      if (e.key === '%') { e.preventDefault(); percent(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, display, prev, op, waiting]);

  const Btn = ({ onClick, className = '', children, wide = false }: { onClick: () => void; className?: string; children: React.ReactNode; wide?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 rounded-xl font-semibold text-lg transition-all active:scale-95 ${wide ? 'col-span-2' : ''} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalcIcon className="w-5 h-5 text-orange-500" />
            Kalkulator
          </DialogTitle>
        </DialogHeader>

        {/* Display */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-4 text-right">
          <div className="text-xs text-slate-400 h-4 truncate">{history || '\u00A0'}</div>
          <div className="text-3xl font-bold text-white truncate mt-1" title={display}>{display}</div>
          {op && (
            <div className="text-[11px] text-orange-400 mt-0.5 uppercase tracking-widest">
              {prev !== null && `${fmt(prev)} ${op} ...`}
            </div>
          )}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <Btn onClick={reset} className="bg-rose-100 text-rose-700 hover:bg-rose-200">AC</Btn>
          <Btn onClick={backspace} className="bg-slate-100 text-slate-700 hover:bg-slate-200">
            <Delete className="w-5 h-5 mx-auto" />
          </Btn>
          <Btn onClick={percent} className="bg-slate-100 text-slate-700 hover:bg-slate-200">%</Btn>
          <Btn onClick={() => applyOperator('÷')} className={`text-white ${op === '÷' ? 'bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'}`}>÷</Btn>

          <Btn onClick={() => inputDigit('7')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">7</Btn>
          <Btn onClick={() => inputDigit('8')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">8</Btn>
          <Btn onClick={() => inputDigit('9')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">9</Btn>
          <Btn onClick={() => applyOperator('×')} className={`text-white ${op === '×' ? 'bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'}`}>×</Btn>

          <Btn onClick={() => inputDigit('4')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">4</Btn>
          <Btn onClick={() => inputDigit('5')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">5</Btn>
          <Btn onClick={() => inputDigit('6')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">6</Btn>
          <Btn onClick={() => applyOperator('-')} className={`text-white ${op === '-' ? 'bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'}`}>−</Btn>

          <Btn onClick={() => inputDigit('1')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">1</Btn>
          <Btn onClick={() => inputDigit('2')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">2</Btn>
          <Btn onClick={() => inputDigit('3')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">3</Btn>
          <Btn onClick={() => applyOperator('+')} className={`text-white ${op === '+' ? 'bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'}`}>+</Btn>

          <Btn onClick={toggleSign} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">±</Btn>
          <Btn onClick={() => inputDigit('0')} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">0</Btn>
          <Btn onClick={inputDecimal} className="bg-white border border-slate-200 text-slate-800 hover:bg-slate-50">,</Btn>
          <Btn onClick={evaluate} className="bg-emerald-500 hover:bg-emerald-600 text-white">=</Btn>
        </div>

        <button
          type="button"
          onClick={copyResult}
          className="mt-3 w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
        >
          <Copy className="w-4 h-4" />
          Salin Hasil
        </button>

        <p className="text-[10px] text-slate-400 text-center mt-2">
          Keyboard: 0-9, + − × ÷, Enter (=), Backspace, Esc (AC)
        </p>
      </DialogContent>
    </Dialog>
  );
}
