import React, { useState } from 'react';
import { X, ArrowRightLeft, Ruler } from 'lucide-react';

interface UnitConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UNITS: Record<string, { label: string; toBase: number }> = {
  m: { label: 'Meters (m)', toBase: 1 },
  cm: { label: 'Centimeters (cm)', toBase: 0.01 },
  mm: { label: 'Millimeters (mm)', toBase: 0.001 },
  ft: { label: 'Feet (ft)', toBase: 0.3048 },
  in: { label: 'Inches (in)', toBase: 0.0254 },
};

const UnitConverterModal: React.FC<UnitConverterModalProps> = ({ isOpen, onClose }) => {
  const [value, setValue] = useState<string>('1');
  const [fromUnit, setFromUnit] = useState<string>('m');
  const [toUnit, setToUnit] = useState<string>('ft');

  if (!isOpen) return null;

  const numericValue = parseFloat(value);
  let result = '---';

  if (!isNaN(numericValue)) {
    const baseValue = numericValue * UNITS[fromUnit].toBase;
    const finalValue = baseValue / UNITS[toUnit].toBase;
    result = finalValue.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (finalValue < 0.0001 && finalValue > 0) {
        result = finalValue.toExponential(4);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2 text-cyan-400">
            <Ruler size={18} />
            <h3 className="text-sm font-bold uppercase tracking-wide">Unit Converter</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* FROM */}
          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-mono uppercase tracking-wider">Convert From</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={value}
                onChange={e => setValue(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none transition-colors"
                placeholder="0.00"
              />
              <div className="relative">
                <select 
                    value={fromUnit}
                    onChange={e => setFromUnit(e.target.value)}
                    className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-white outline-none cursor-pointer focus:border-cyan-500 transition-colors"
                >
                    {Object.entries(UNITS).map(([key, u]) => (
                    <option key={key} value={key}>{key}</option>
                    ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4"/></svg>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">{UNITS[fromUnit].label}</p>
          </div>

          {/* DIVIDER */}
          <div className="flex items-center justify-center">
            <div className="bg-slate-800 p-2 rounded-full text-cyan-500">
                <ArrowRightLeft size={16} />
            </div>
          </div>

          {/* TO */}
          <div className="space-y-2">
            <label className="text-xs text-slate-500 font-mono uppercase tracking-wider">Convert To</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-cyan-400 font-mono font-bold flex items-center overflow-x-auto">
                {result}
              </div>
              <div className="relative">
                <select 
                    value={toUnit}
                    onChange={e => setToUnit(e.target.value)}
                    className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-white outline-none cursor-pointer focus:border-cyan-500 transition-colors"
                >
                    {Object.entries(UNITS).map(([key, u]) => (
                    <option key={key} value={key}>{key}</option>
                    ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l4 4 4-4"/></svg>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">{UNITS[toUnit].label}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnitConverterModal;