import React, { useState, useEffect } from 'react';
import { X, Edit3, Tag, Layers, Check } from 'lucide-react';

interface InspectorPanelProps {
  elementId: string;
  elementType: string;
  attributes: Record<string, string>;
  onUpdate: (newAttributes: Record<string, string>) => void;
  onClose: () => void;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ elementId, elementType, attributes, onUpdate, onClose }) => {
  const [localId, setLocalId] = useState(elementId);
  const [stroke, setStroke] = useState(attributes.stroke || '#22d3ee');
  const [fill, setFill] = useState(attributes.fill || 'none');
  const [strokeWidth, setStrokeWidth] = useState(attributes['stroke-width'] || '2');

  useEffect(() => {
    setLocalId(elementId);
    setStroke(attributes.stroke || '#22d3ee');
    setFill(attributes.fill || 'none');
    setStrokeWidth(attributes['stroke-width'] || '2');
  }, [elementId, attributes]);

  const handleApply = () => {
    onUpdate({
      id: localId,
      stroke,
      fill,
      'stroke-width': strokeWidth
    });
  };

  return (
    <div className="absolute top-20 left-4 z-40 w-64 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-left-5 duration-200">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-2 text-cyan-400">
          <Edit3 size={16} />
          <span className="text-xs font-bold uppercase tracking-wider">Object Inspector</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        
        {/* ID Field */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 font-mono uppercase flex items-center gap-1">
            <Tag size={10} /> Element ID
          </label>
          <input 
            type="text" 
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-white font-mono focus:border-cyan-500 outline-none"
          />
        </div>

        {/* Type Info (Read only) */}
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500 font-mono uppercase flex items-center gap-1">
            <Layers size={10} /> Type
          </label>
          <div className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-400 font-mono capitalize">
            {elementType || 'Geometry'}
          </div>
        </div>

        {/* Styling */}
        <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-mono uppercase">Stroke</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="color" 
                        value={stroke}
                        onChange={(e) => setStroke(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-xs text-slate-400 font-mono">{stroke}</span>
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-mono uppercase">Fill</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="color" 
                        value={fill === 'none' ? '#000000' : fill}
                        onChange={(e) => setFill(e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <button 
                        onClick={() => setFill(fill === 'none' ? '#334155' : 'none')}
                        className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 hover:bg-slate-700"
                    >
                        {fill === 'none' ? 'None' : 'Set'}
                    </button>
                </div>
            </div>
        </div>

        <div className="space-y-1">
             <label className="text-[10px] text-slate-500 font-mono uppercase">Stroke Width</label>
             <input 
                type="range" 
                min="0.5" max="10" step="0.5"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(e.target.value)}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
             />
             <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                 <span>Thin</span>
                 <span>{strokeWidth}px</span>
                 <span>Thick</span>
             </div>
        </div>

        {/* Action */}
        <button 
            onClick={handleApply}
            className="w-full flex items-center justify-center gap-2 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold py-2 rounded transition-colors mt-2"
        >
            <Check size={14} />
            APPLY CHANGES
        </button>

      </div>
    </div>
  );
};

export default InspectorPanel;