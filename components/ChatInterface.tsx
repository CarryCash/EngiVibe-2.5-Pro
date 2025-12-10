import React, { useRef, useEffect, useState } from 'react';
import { Message, AppStatus, DesignData } from '../types';
import { Send, Bot, User, Loader2, Settings2, MapPin, CheckCircle2, History, RotateCcw } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onConfirmLocation: (lat: number, lng: number, prompt: string) => void;
  onRestoreSnapshot: (design: DesignData) => void;
  status: AppStatus;
  projectDescription: string;
  onProjectDescriptionChange: (val: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  onConfirmLocation,
  onRestoreSnapshot,
  status,
  projectDescription,
  onProjectDescriptionChange
}) => {
  const [input, setInput] = useState('');
  const [showScope, setShowScope] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Regex to catch Google Maps coordinates in URL: @-12.345,76.543
  const COORD_REGEX = /@(-?\d+\.\d+),(-?\d+\.\d+)/;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === AppStatus.THINKING) return;

    // 1. Check for Google Maps URL
    const match = input.match(COORD_REGEX);
    
    if (match) {
      onSendMessage(input); 
      setInput('');
    } else {
      // Normal text
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex flex-col gap-2">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                EngiVibe 2.5 Pro
                </h1>
                <p className="text-xs text-slate-500 font-mono">Powered by Gemini 3 Pro</p>
            </div>
            <button 
                onClick={() => setShowScope(!showScope)}
                className={`p-2 rounded hover:bg-slate-800 transition-colors ${showScope ? 'text-cyan-400 bg-slate-800' : 'text-slate-400'}`}
                title="Project Scope Configuration"
            >
                <Settings2 size={18} />
            </button>
        </div>
        
        {/* Project Scope Section */}
        {showScope && (
            <div className="mt-2 animate-in slide-in-from-top-2 duration-200">
                <label className="text-[10px] text-cyan-500 font-mono uppercase tracking-wider mb-1 block">
                    Project Context / Description
                </label>
                <textarea
                    value={projectDescription}
                    onChange={(e) => onProjectDescriptionChange(e.target.value)}
                    placeholder="Enter global constraints (e.g., 'Location: California, Seismic Zone 4, Soil Bearing: 150kPa, Material: C30/37 Concrete')..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:ring-0 resize-y min-h-[80px]"
                />
            </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
              msg.role === 'model' ? 'bg-cyan-900/50 text-cyan-400' : 'bg-slate-700 text-slate-300'
            }`}>
              {msg.role === 'model' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {/* Message Content */}
              {msg.locationRequest ? (
                // Special Map Card
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden w-full max-w-[300px]">
                    <div className="bg-slate-950 px-3 py-2 border-b border-slate-700 flex items-center gap-2">
                        <MapPin size={14} className="text-red-500" />
                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">Site Confirmation</span>
                    </div>
                    <div className="relative h-[150px] bg-slate-900">
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            scrolling="no" 
                            src={`https://maps.google.com/maps?q=${msg.locationRequest.lat},${msg.locationRequest.lng}&t=k&z=19&output=embed`}
                            className="opacity-90 hover:opacity-100 transition-opacity"
                        ></iframe>
                        <div className="absolute inset-0 pointer-events-none shadow-inner border-b border-slate-700"></div>
                    </div>
                    <div className="p-3">
                        <p className="text-xs text-slate-400 mb-3">
                            Is this the correct construction site? I will import the building footprint.
                        </p>
                        <button 
                            onClick={() => onConfirmLocation(msg.locationRequest!.lat, msg.locationRequest!.lng, msg.locationRequest!.originalPrompt)}
                            className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white text-xs font-bold py-2 px-4 rounded transition-colors"
                        >
                            <CheckCircle2 size={14} />
                            CONFIRM & IMPORT
                        </button>
                    </div>
                </div>
              ) : (
                // Standard Text
                <div className={`p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user' 
                    ? 'bg-slate-800 text-slate-100 border border-slate-700' 
                    : 'text-slate-300'
                }`}>
                    {msg.text}
                </div>
              )}
              
              {/* Design Snapshot Card */}
              {msg.designSnapshot && (
                  <button 
                    onClick={() => onRestoreSnapshot(msg.designSnapshot!)}
                    className="mt-2 w-full max-w-[200px] flex items-center gap-3 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 rounded-lg p-2 transition-all group text-left"
                    title="Restore this design version"
                  >
                      {/* Mini SVG Thumbnail */}
                      <div className="w-12 h-10 bg-slate-950 rounded border border-slate-800 overflow-hidden relative shrink-0">
                          <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                             <svg viewBox={msg.designSnapshot.viewBox} className="w-full h-full">
                                <g dangerouslySetInnerHTML={{__html: msg.designSnapshot.svgContent}} />
                             </svg>
                          </div>
                      </div>
                      <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-cyan-500 font-bold uppercase flex items-center gap-1">
                              <History size={10} />
                              Version Snapshot
                          </span>
                          <span className="text-xs text-slate-400 truncate w-full">
                              {msg.designSnapshot.projectTitle || "Untitled Design"}
                          </span>
                      </div>
                      <RotateCcw size={14} className="text-slate-600 group-hover:text-cyan-400 ml-auto" />
                  </button>
              )}

              <span className="text-[10px] text-slate-600 mt-1 font-mono">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        ))}
        
        {status === AppStatus.THINKING && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded bg-cyan-900/50 text-cyan-400 flex items-center justify-center shrink-0">
               <Bot size={18} />
             </div>
             <div className="flex items-center gap-2 text-cyan-500 text-sm font-mono mt-1">
                <Loader2 size={14} className="animate-spin" />
                <span>Solving engineering constraints...</span>
             </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="E.g. 'Design a warehouse' or paste a Google Maps Link..."
            disabled={status === AppStatus.THINKING}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all disabled:opacity-50 font-mono"
          />
          <button
            type="submit"
            disabled={!input.trim() || status === AppStatus.THINKING}
            className="absolute right-2 top-2 p-1.5 bg-cyan-600 text-white rounded hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;