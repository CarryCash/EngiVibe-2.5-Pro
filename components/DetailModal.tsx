import React from 'react';
import { StructuralDetail } from '../types';
import { X, ZoomIn, Info } from 'lucide-react';

interface DetailModalProps {
  detail: StructuralDetail | null;
  onClose: () => void;
  isLoading: boolean;
}

const DetailModal: React.FC<DetailModalProps> = ({ detail, onClose, isLoading }) => {
  if (!detail && !isLoading) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-900/30 rounded text-indigo-400">
                <ZoomIn size={20} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wide">
                    {isLoading ? 'GENERATING DETAIL...' : detail?.elementId}
                </h3>
                {!isLoading && (
                    <p className="text-xs text-slate-500 font-mono">{detail?.elementType}</p>
                )}
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
             <div className="flex-1 flex flex-col items-center justify-center gap-4">
                 <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                 <p className="text-slate-400 font-mono animate-pulse">Computing Reinforcement Geometry...</p>
             </div>
        ) : detail ? (
             <div className="flex-1 flex overflow-hidden">
                {/* SVG Viewer */}
                <div className="flex-1 bg-[#0F1218] relative flex items-center justify-center p-8 overflow-hidden">
                     {/* Subtle Blueprint Grid */}
                     <div className="absolute inset-0 opacity-10 pointer-events-none" 
                        style={{
                            backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                     />
                     <svg 
                        viewBox="0 0 100 100" 
                        className="w-full h-full drop-shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                        preserveAspectRatio="xMidYMid meet"
                     >
                        <defs>
                             <marker id="detail-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <path d="M0,0 L0,6 L6,3 z" fill="#facc15" />
                             </marker>
                        </defs>
                        <g dangerouslySetInnerHTML={{ __html: detail.svgContent }} />
                     </svg>
                </div>

                {/* Specs Panel */}
                <div className="w-64 bg-slate-950 border-l border-slate-800 p-4 overflow-y-auto">
                    <div className="flex items-center gap-2 text-indigo-400 mb-4 pb-2 border-b border-indigo-900/30">
                        <Info size={16} />
                        <span className="font-bold text-xs uppercase">Specifications</span>
                    </div>
                    <ul className="space-y-3">
                        {detail.specifications.map((spec, i) => (
                            <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                <span className="leading-snug">{spec}</span>
                            </li>
                        ))}
                    </ul>
                </div>
             </div>
        ) : null}
      </div>
    </div>
  );
};

export default DetailModal;