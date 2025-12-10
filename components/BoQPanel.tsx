import React, { useState, useEffect } from 'react';
import { BillOfQuantities } from '../types';
import { Calculator, Box, Layers, Hammer, DollarSign, TrendingUp } from 'lucide-react';

interface BoQPanelProps {
  data: BillOfQuantities | undefined;
}

const BoQPanel: React.FC<BoQPanelProps> = ({ data }) => {
  // State to hold user-defined unit prices
  // Keyed by index for simplicity in this view
  const [unitPrices, setUnitPrices] = useState<Record<number, number>>({});

  // Initialize prices when data loads
  useEffect(() => {
    if (data) {
        const initialPrices: Record<number, number> = {};
        data.items.forEach((item, idx) => {
            // Default to AI estimate if present, otherwise 0
            initialPrices[idx] = item.unitPriceEstimate || 0;
        });
        setUnitPrices(initialPrices);
    }
  }, [data]);

  const handlePriceChange = (index: number, val: string) => {
      const num = parseFloat(val);
      setUnitPrices(prev => ({
          ...prev,
          [index]: isNaN(num) ? 0 : num
      }));
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
        <Calculator size={32} className="opacity-50" />
        <p className="text-sm">No quantity data available yet.</p>
      </div>
    );
  }

  // Helper for formatting numbers
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  // Calculate Grand Total
  const grandTotal = data.items.reduce((acc, item, idx) => {
      const price = unitPrices[idx] || 0;
      return acc + (item.quantity * price);
  }, 0);

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      <div className="font-mono text-xs text-cyan-500 border-b border-cyan-500/30 pb-1 shrink-0 flex justify-between items-center">
        <span>// BILL_OF_QUANTITIES_&_COSTS</span>
        <span className="text-[10px] text-slate-500">Auto-Calculated</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col items-center justify-center text-center">
          <div className="text-cyan-400 mb-1"><Box size={16} /></div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Concrete Vol.</span>
          <span className="text-sm font-bold text-slate-100">{fmt(data.summary.totalConcreteVolume)} m³</span>
        </div>
        <div className="bg-emerald-900/30 p-2 rounded border border-emerald-800/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="text-emerald-400 mb-1"><DollarSign size={16} /></div>
          <span className="text-[10px] text-emerald-400/80 uppercase tracking-wide font-bold">Estimated Cost</span>
          <span className="text-lg font-bold text-emerald-100">{fmtMoney(grandTotal)}</span>
          <div className="absolute -right-2 -top-2 opacity-10 text-emerald-400">
              <TrendingUp size={48} />
          </div>
        </div>
        <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col items-center justify-center text-center">
          <div className="text-fuchsia-400 mb-1"><Hammer size={16} /></div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Steel (Kg)</span>
          <span className="text-sm font-bold text-slate-100">{fmt(data.summary.totalSteelWeight)}</span>
        </div>
        <div className="bg-slate-800 p-2 rounded border border-slate-700 flex flex-col items-center justify-center text-center">
          <div className="text-yellow-400 mb-1"><Layers size={16} /></div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">Formwork (m²)</span>
          <span className="text-sm font-bold text-slate-100">{fmt(data.summary.totalFormworkArea)}</span>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="flex-1 overflow-auto border border-slate-800 rounded-lg bg-slate-900 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-2 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-800 w-10">#</th>
              <th className="p-2 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-800">Description</th>
              <th className="p-2 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-800 w-10 text-center">Unit</th>
              <th className="p-2 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-800 w-14 text-right">Qty</th>
              <th className="p-2 text-[10px] font-mono text-emerald-600 uppercase border-b border-slate-800 w-20 text-right">Unit Price</th>
              <th className="p-2 text-[10px] font-mono text-emerald-600 uppercase border-b border-slate-800 w-20 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.items.map((item, idx) => {
              const unitPrice = unitPrices[idx] || 0;
              const lineTotal = item.quantity * unitPrice;
              
              return (
                <tr key={idx} className="hover:bg-slate-800/50 transition-colors text-xs text-slate-300 group">
                    <td className="p-2 font-mono text-slate-600">{idx + 1}</td>
                    <td className="p-2">
                        <div className="font-medium text-slate-200">{item.description}</div>
                        {item.remarks && <div className="text-[10px] text-slate-500 italic mt-0.5">{item.remarks}</div>}
                    </td>
                    <td className="p-2 text-center font-mono text-slate-400">{item.unit}</td>
                    <td className="p-2 text-right font-mono text-cyan-400 font-bold">{fmt(item.quantity)}</td>
                    <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                            <span className="text-[10px] text-slate-600">$</span>
                            <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                value={unitPrices[idx] === 0 ? '' : unitPrices[idx]}
                                onChange={(e) => handlePriceChange(idx, e.target.value)}
                                className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-right text-xs text-white focus:border-emerald-500 outline-none transition-colors placeholder-slate-600"
                                placeholder="0.00"
                            />
                        </div>
                    </td>
                    <td className="p-2 text-right font-mono text-emerald-400 font-bold">
                        {lineTotal > 0 ? fmtMoney(lineTotal) : '-'}
                    </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-950/80 sticky bottom-0 border-t border-slate-800 backdrop-blur-sm">
              <tr>
                  <td colSpan={5} className="p-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Project Grand Total:</td>
                  <td className="p-3 text-right text-sm font-bold text-emerald-400">{fmtMoney(grandTotal)}</td>
              </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="text-[10px] text-slate-600 text-center shrink-0">
        * Enter unit prices to calculate total estimated cost. Values are not saved to database.
      </div>
    </div>
  );
};

export default BoQPanel;