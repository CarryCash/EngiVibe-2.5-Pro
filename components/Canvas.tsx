import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize, Move, Crosshair, Grid as GridIcon, Ruler, Trash2, MousePointer2, MapPin, ExternalLink, Search, ArrowRightLeft, Square, Circle, PenTool, Spline, Undo, Redo, Eraser } from 'lucide-react';
import { GeoLocation } from '../types';
import InspectorPanel from './InspectorPanel';

interface CanvasProps {
  svgContent: string | null;
  viewBox: string;
  geoLocation?: GeoLocation | null;
  onReqDetail?: (elementId: string) => void;
  onOpenConverter?: () => void;
  onSvgUpdate?: (newContent: string) => void;
}

type ToolType = 'select' | 'measure' | 'detail' | 'draw_rect' | 'draw_circle' | 'draw_polyline' | 'draw_arc';

interface Measurement {
  p1: { x: number, y: number };
  p2: { x: number, y: number };
  distance: number;
}

interface UserShape {
    id: string;
    type: 'rect' | 'circle' | 'polyline' | 'arc';
    data: any; 
    color: string;
}

interface SelectedElement {
    id: string;
    type: string;
    attributes: Record<string, string>;
    bbox: DOMRect | null;
}

const Canvas: React.FC<CanvasProps> = ({ svgContent, viewBox, geoLocation, onReqDetail, onOpenConverter, onSvgUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragStartRef = useRef<{x: number, y: number} | null>(null);
  
  // Base model dimensions
  const baseViewBox = useMemo(() => {
    const parts = viewBox.trim().split(/\s+/).map(Number);
    return parts.length === 4 ? parts : [0, 0, 100, 100];
  }, [viewBox]);

  // Viewport State
  const [viewState, setViewState] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  // Tools & Measurements
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [measureStart, setMeasureStart] = useState<{ x: number, y: number } | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [detailInput, setDetailInput] = useState('');

  // Drawing State & History
  const [userShapes, setUserShapes] = useState<UserShape[]>([]);
  const [currentShape, setCurrentShape] = useState<UserShape | null>(null);
  const [drawStep, setDrawStep] = useState(0);
  
  // Undo/Redo Stacks
  const [history, setHistory] = useState<UserShape[][]>([]);
  const [future, setFuture] = useState<UserShape[][]>([]);

  // Inspector State
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

  // Initialize/Reset
  useEffect(() => {
    setViewState({
      x: baseViewBox[0],
      y: baseViewBox[1],
      w: baseViewBox[2],
      h: baseViewBox[3]
    });
    setMeasurements([]); 
    setUserShapes([]);
    setHistory([]);
    setFuture([]);
    setSelectedElement(null);
  }, [baseViewBox]);

  // History Helper
  const saveState = () => {
      setHistory(prev => [...prev, userShapes]);
      setFuture([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      
      setFuture(prev => [userShapes, ...prev]);
      setUserShapes(previous);
      setHistory(newHistory);
  };

  const handleRedo = () => {
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);
      
      setHistory(prev => [...prev, userShapes]);
      setUserShapes(next);
      setFuture(newFuture);
  };

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  handleRedo();
              } else {
                  handleUndo();
              }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
              e.preventDefault();
              handleRedo();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, future, userShapes]);

  // --- Zoom Logic ---
  const handleZoom = (factor: number) => {
    if (!viewState) return;
    const newW = viewState.w / factor;
    const newH = viewState.h / factor;
    const dx = (viewState.w - newW) / 2;
    const dy = (viewState.h - newH) / 2;
    setViewState({ x: viewState.x + dx, y: viewState.y + dy, w: newW, h: newH });
  };

  const handleZoomIn = () => handleZoom(1.2);
  const handleZoomOut = () => handleZoom(0.8);
  const handleReset = () => {
    setViewState({ x: baseViewBox[0], y: baseViewBox[1], w: baseViewBox[2], h: baseViewBox[3] });
  };

  // --- Interaction Logic ---
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    if (!cursorPos) return;

    // MEASURE
    if (activeTool === 'measure') {
      if (!measureStart) {
        setMeasureStart(cursorPos);
      } else {
        const distance = Math.hypot(cursorPos.x - measureStart.x, cursorPos.y - measureStart.y);
        if (distance > 0.01) {
            setMeasurements(prev => [...prev, { p1: measureStart!, p2: cursorPos!, distance: parseFloat(distance.toFixed(3)) }]);
        }
        setMeasureStart(null); 
      }
      return;
    }

    // DRAWING
    if (activeTool.startsWith('draw_')) {
        handleDrawingStart(activeTool, cursorPos);
        return;
    }

    // SELECT / PAN
    if (activeTool === 'select') {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleDrawingStart = (tool: ToolType, pos: {x: number, y: number}) => {
      if (tool === 'draw_rect') {
        setCurrentShape({ id: Date.now().toString(), type: 'rect', color: '#10b981', data: { x: pos.x, y: pos.y, w: 0, h: 0, startX: pos.x, startY: pos.y } });
      } else if (tool === 'draw_circle') {
        setCurrentShape({ id: Date.now().toString(), type: 'circle', color: '#10b981', data: { cx: pos.x, cy: pos.y, r: 0 } });
      } else if (tool === 'draw_polyline') {
        if (!currentShape) {
            setCurrentShape({ id: Date.now().toString(), type: 'polyline', color: '#10b981', data: { points: [pos, pos] } });
        } else {
            const newPoints = [...currentShape.data.points, pos];
            setCurrentShape({ ...currentShape, data: { points: newPoints } });
        }
      } else if (tool === 'draw_arc') {
        if (drawStep === 0) {
            setCurrentShape({ id: Date.now().toString(), type: 'arc', color: '#10b981', data: { p1: pos, p2: pos, control: pos } });
            setDrawStep(1);
        } else if (drawStep === 1) setDrawStep(2);
        else if (drawStep === 2) {
            if (currentShape) {
                saveState();
                setUserShapes(prev => [...prev, currentShape]);
            }
            setCurrentShape(null);
            setDrawStep(0);
        }
      }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    // 1. Panning
    if (isPanning && activeTool === 'select' && viewState && containerRef.current) {
      const dxPx = e.clientX - lastMousePos.x;
      const dyPx = e.clientY - lastMousePos.y;
      const ratioX = viewState.w / containerRef.current.clientWidth;
      const ratioY = viewState.h / containerRef.current.clientHeight;
      setViewState({ ...viewState, x: viewState.x - dxPx * ratioX, y: viewState.y - dyPx * ratioY });
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }

    // 2. Cursor Snapping
    if (svgRef.current && viewState) {
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const worldPt = pt.matrixTransform(ctm.inverse());
        let finalX = worldPt.x;
        let finalY = worldPt.y;
        if (snapEnabled) {
          const SNAP = 0.5;
          finalX = Math.round(finalX / SNAP) * SNAP;
          finalY = Math.round(finalY / SNAP) * SNAP;
        }
        
        const newCursorPos = { x: finalX, y: finalY };
        setCursorPos(newCursorPos);

        // 3. Update Drawing Shape Preview
        updateDrawingPreview(newCursorPos);
      }
    }
  };

  const updateDrawingPreview = (pos: {x: number, y: number}) => {
      if (!currentShape) return;
      if (currentShape.type === 'rect') {
          const startX = currentShape.data.startX;
          const startY = currentShape.data.startY;
          const w = pos.x - startX;
          const h = pos.y - startY;
          setCurrentShape({ ...currentShape, data: { ...currentShape.data, x: w < 0 ? pos.x : startX, y: h < 0 ? pos.y : startY, w: Math.abs(w), h: Math.abs(h) } });
      } else if (currentShape.type === 'circle') {
          const r = Math.hypot(pos.x - currentShape.data.cx, pos.y - currentShape.data.cy);
          setCurrentShape({ ...currentShape, data: { ...currentShape.data, r } });
      } else if (currentShape.type === 'polyline') {
          const pts = [...currentShape.data.points];
          pts[pts.length - 1] = pos;
          setCurrentShape({ ...currentShape, data: { points: pts } });
      } else if (currentShape.type === 'arc') {
          if (drawStep === 1) {
              setCurrentShape({ ...currentShape, data: { ...currentShape.data, p2: pos, control: { x: (currentShape.data.p1.x + pos.x)/2, y: (currentShape.data.p1.y + pos.y)/2 } } });
          } else if (drawStep === 2) {
              setCurrentShape({ ...currentShape, data: { ...currentShape.data, control: pos } });
          }
      }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    setIsPanning(false);

    // Finish Drag Shapes
    if (currentShape && (activeTool === 'draw_rect' || activeTool === 'draw_circle')) {
        const valid = activeTool === 'draw_rect' ? (currentShape.data.w > 0) : (currentShape.data.r > 0);
        if (valid) {
            saveState();
            setUserShapes(prev => [...prev, currentShape]);
        }
        setCurrentShape(null);
    }

    // Handle Selection (Smart Object Inspector)
    if (activeTool === 'select' && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        // Only trigger selection if it was a click (not a drag)
        if (Math.hypot(dx, dy) < 5) {
            handleElementClick(e.target as Element);
        }
    }
    dragStartRef.current = null;
  };

  const handleElementClick = (target: Element) => {
      // Traverse up to find a valid identifiable SVG element
      let current: Element | null = target;
      let depth = 0;
      let found = false;

      // Deselect if clicking background
      if (target === svgRef.current || target.tagName === 'svg' || target.id === 'grid-layer') {
          setSelectedElement(null);
          return;
      }

      while (current && current !== svgRef.current && depth < 5) {
          if (current.id && !current.id.startsWith('grid') && !current.id.startsWith('arrow')) {
              // Found a candidate
              const bbox = (current as SVGGraphicsElement).getBBox();
              const attrs: Record<string, string> = {};
              for (let i = 0; i < current.attributes.length; i++) {
                  const attr = current.attributes[i];
                  attrs[attr.name] = attr.value;
              }

              // Extract type from data-type or guess
              const type = current.getAttribute('data-type') || current.tagName;

              setSelectedElement({
                  id: current.id,
                  type: type,
                  attributes: attrs,
                  bbox: bbox
              });
              found = true;
              break;
          }
          current = current.parentElement;
          depth++;
      }

      if (!found) setSelectedElement(null);
  };

  // Handle updates from Inspector
  const handleInspectorUpdate = (newAttrs: Record<string, string>) => {
      if (!selectedElement || !svgContent) return;

      // Visual Update (Immediate)
      const el = document.getElementById(selectedElement.id);
      if (el) {
          if (newAttrs.id !== selectedElement.id) el.id = newAttrs.id;
          el.setAttribute('stroke', newAttrs.stroke);
          el.setAttribute('fill', newAttrs.fill);
          el.setAttribute('stroke-width', newAttrs['stroke-width']);
      }

      // State Update (For persistence)
      setSelectedElement(prev => prev ? ({
          ...prev,
          id: newAttrs.id,
          attributes: { ...prev.attributes, ...newAttrs }
      }) : null);
  };

  const onDoubleClick = () => {
      if (activeTool === 'draw_polyline' && currentShape) {
          saveState();
          setUserShapes(prev => [...prev, currentShape]);
          setCurrentShape(null);
      }
  };

  const clearMeasurements = () => {
    setMeasurements([]);
    setMeasureStart(null);
  };

  const clearUserShapes = () => {
      if (userShapes.length > 0) saveState();
      setUserShapes([]);
      setCurrentShape(null);
      setDrawStep(0);
  };
  
  const handleRequestDetail = (e: React.FormEvent) => {
      e.preventDefault();
      if (detailInput.trim() && onReqDetail) {
          onReqDetail(detailInput.trim());
          setDetailInput('');
          setActiveTool('select');
      }
  };

  const gridBounds = {
      x: baseViewBox[0] - baseViewBox[2] * 5,
      y: baseViewBox[1] - baseViewBox[3] * 5,
      width: baseViewBox[2] * 10,
      height: baseViewBox[3] * 10
  };

  const currentZoomPct = viewState ? Math.round((baseViewBox[2] / viewState.w) * 100) : 100;
  const currentViewBoxStr = viewState ? `${viewState.x} ${viewState.y} ${viewState.w} ${viewState.h}` : viewBox;

  // Helper for button class
  const btnClass = (isActive: boolean) => 
    `p-2 rounded transition-all duration-200 relative group ${
        isActive 
        ? 'bg-cyan-600 text-white shadow-lg scale-105' 
        : 'text-slate-400 hover:bg-slate-700 hover:text-white hover:scale-105'
    }`;

  const separatorClass = "w-[1px] h-6 bg-slate-700 mx-1";

  return (
    <div className="relative flex flex-col w-full h-full bg-[#0F1218] border border-slate-800 rounded-lg overflow-hidden group shadow-inner">
      
      {/* Inspector Panel Overlay */}
      {selectedElement && (
          <InspectorPanel 
            elementId={selectedElement.id}
            elementType={selectedElement.type}
            attributes={selectedElement.attributes}
            onUpdate={handleInspectorUpdate}
            onClose={() => setSelectedElement(null)}
          />
      )}

      {/* Top Left: Tool Palette (Refined) */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
        <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl">
          
          {/* 1. Selection & Navigation */}
          <button 
            onClick={() => setActiveTool('select')}
            className={btnClass(activeTool === 'select')}
            title="Select & Pan (Click object to Inspect)"
          >
            <MousePointer2 size={20} />
          </button>
          
          <div className={separatorClass}></div>
          
          {/* 2. Measurement */}
          <button 
            onClick={() => { setActiveTool('measure'); setMeasureStart(null); }}
            className={btnClass(activeTool === 'measure')}
            title="Tape Measure (Distance)"
          >
            <Ruler size={20} />
          </button>

          <div className={separatorClass}></div>

          {/* 3. Drawing Tools */}
          <div className="flex gap-1 bg-slate-800/50 p-0.5 rounded-lg border border-slate-700/50">
            <button 
                onClick={() => { setActiveTool('draw_rect'); setCurrentShape(null); }}
                className={btnClass(activeTool === 'draw_rect')}
                title="Draw Rectangle"
            >
                <Square size={18} />
            </button>
            <button 
                onClick={() => { setActiveTool('draw_circle'); setCurrentShape(null); }}
                className={btnClass(activeTool === 'draw_circle')}
                title="Draw Circle"
            >
                <Circle size={18} />
            </button>
            <button 
                onClick={() => { setActiveTool('draw_polyline'); setCurrentShape(null); }}
                className={btnClass(activeTool === 'draw_polyline')}
                title="Draw Polyline"
            >
                <PenTool size={18} />
            </button>
            <button 
                onClick={() => { setActiveTool('draw_arc'); setCurrentShape(null); setDrawStep(0); }}
                className={btnClass(activeTool === 'draw_arc')}
                title="Draw Arc (3-Point)"
            >
                <Spline size={18} />
            </button>
          </div>

          <div className={separatorClass}></div>

          {/* 4. AI & Detail */}
          <button 
            onClick={() => setActiveTool('detail')}
            className={btnClass(activeTool === 'detail')}
            title="AI Structural Detail Generator"
          >
            <Search size={20} />
          </button>

          <div className={separatorClass}></div>

          {/* 5. Utilities */}
          <button 
            onClick={onOpenConverter}
            className={btnClass(false)}
            title="Unit Converter"
          >
            <ArrowRightLeft size={20} />
          </button>
          
          <div className={separatorClass}></div>

          {/* 6. History */}
          <div className="flex gap-1">
            <button 
                onClick={handleUndo}
                disabled={history.length === 0}
                className={`p-2 rounded transition-colors ${history.length === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                title="Undo (Ctrl+Z)"
            >
                <Undo size={18} />
            </button>
            <button 
                onClick={handleRedo}
                disabled={future.length === 0}
                className={`p-2 rounded transition-colors ${future.length === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                title="Redo (Ctrl+Y)"
            >
                <Redo size={18} />
            </button>
          </div>

          {/* 7. Clear Actions */}
          {(measurements.length > 0 || userShapes.length > 0) && (
             <>
                <div className={separatorClass}></div>
                <button 
                    onClick={() => { clearMeasurements(); clearUserShapes(); }}
                    className="p-2 text-red-400 hover:bg-red-900/50 rounded transition-colors" 
                    title="Clear All Measurements & Drawings"
                >
                    <Eraser size={18} />
                </button>
             </>
          )}
        </div>

        {/* Detail Input Overlay */}
        {activeTool === 'detail' && (
            <div className="animate-in fade-in zoom-in duration-200 mt-1 ml-1">
                <form onSubmit={handleRequestDetail} className="flex gap-2 items-center bg-slate-900/95 backdrop-blur p-2 rounded-lg border border-cyan-500/50 shadow-2xl">
                    <input 
                        type="text" 
                        autoFocus
                        value={detailInput}
                        onChange={e => setDetailInput(e.target.value)}
                        placeholder="Element ID..." 
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-32 font-mono"
                    />
                    <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white p-1.5 rounded">
                        <ZoomIn size={14} />
                    </button>
                </form>
            </div>
        )}

        {/* Geo-Context Badge */}
        {geoLocation && activeTool !== 'detail' && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${geoLocation.lat},${geoLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-blue-300 hover:text-white hover:bg-blue-900/50 transition-colors shadow-lg cursor-pointer max-w-fit mt-1 ml-1"
          >
             <MapPin size={14} className="text-red-400" />
             <span className="font-medium max-w-[150px] truncate">{geoLocation.locationName || `${geoLocation.lat.toFixed(3)}, ${geoLocation.lng.toFixed(3)}`}</span>
             <ExternalLink size={10} className="text-slate-500" />
          </a>
        )}
      </div>

      {/* Top Right: View Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg p-1 flex gap-1 shadow-xl">
          <button onClick={handleZoomOut} className="p-2 text-slate-400 hover:bg-slate-700 hover:text-white rounded transition-colors" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button onClick={handleReset} className="p-2 text-slate-400 hover:bg-slate-700 hover:text-white rounded transition-colors" title="Fit to Screen">
            <Maximize size={18} />
          </button>
          <button onClick={handleZoomIn} className="p-2 text-slate-400 hover:bg-slate-700 hover:text-white rounded transition-colors" title="Zoom In">
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Main SVG Area */}
      <div 
        ref={containerRef} 
        className={`flex-1 w-full h-full overflow-hidden relative ${
            activeTool === 'select' ? (isPanning ? 'cursor-grabbing' : 'cursor-crosshair') : 'cursor-crosshair'
        }`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onMouseLeave={(e) => { onMouseUp(e); setCursorPos(null); }}
        onDragStart={(e) => e.preventDefault()}
      >
        {svgContent ? (
          <div className="w-full h-full">
             <svg 
                ref={svgRef}
                viewBox={currentViewBoxStr} 
                className="w-full h-full select-none"
                preserveAspectRatio="xMidYMid meet"
             >
                <style>
                  {`
                    .cad-geometry path, .cad-geometry line, .cad-geometry rect, .cad-geometry circle, .cad-geometry polyline, .cad-geometry polygon {
                      vector-effect: non-scaling-stroke;
                      stroke-width: 2px !important;
                      paint-order: stroke;
                      stroke-linecap: round;
                      stroke-linejoin: round;
                      pointer-events: all;
                      cursor: pointer;
                    }
                    .cad-geometry { filter: drop-shadow(0 0 1px rgba(34, 211, 238, 0.4)); }
                    .cad-geometry text { vector-effect: none; font-weight: bold; filter: drop-shadow(0 0 2px rgba(0,0,0,1)); }
                    .grid-line { vector-effect: non-scaling-stroke; pointer-events: none; }
                    .measure-line { vector-effect: non-scaling-stroke; }
                    .user-shape { vector-effect: non-scaling-stroke; stroke-width: 2px; fill: none; stroke-linecap: round; stroke-linejoin: round; }
                  `}
                </style>
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#facc15" />
                  </marker>
                  <marker id="measure-dot" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                    <circle cx="3" cy="3" r="2" fill="#e879f9" />
                  </marker>
                  <pattern id="grid-pattern" width="1" height="1" patternUnits="userSpaceOnUse">
                    <path d="M 1 0 L 0 0 L 0 1" fill="none" stroke="#334155" strokeWidth="0.5" className="grid-line" />
                  </pattern>
                  <pattern id="grid-pattern-major" width="5" height="5" patternUnits="userSpaceOnUse">
                    <rect width="5" height="5" fill="url(#grid-pattern)" />
                    <path d="M 5 0 L 0 0 L 0 5" fill="none" stroke="#475569" strokeWidth="1" className="grid-line" />
                  </pattern>
                </defs>

                {/* Grid */}
                <rect id="grid-layer" x={gridBounds.x} y={gridBounds.y} width={gridBounds.width} height={gridBounds.height} fill="url(#grid-pattern-major)" />
                
                {/* AI Content */}
                <g className="cad-geometry" dangerouslySetInnerHTML={{ __html: svgContent }} />

                {/* Selection Highlight */}
                {selectedElement && selectedElement.bbox && (
                    <rect 
                        x={selectedElement.bbox.x - 0.5} 
                        y={selectedElement.bbox.y - 0.5} 
                        width={selectedElement.bbox.width + 1} 
                        height={selectedElement.bbox.height + 1} 
                        fill="none" 
                        stroke="#22d3ee" 
                        strokeWidth="2" 
                        strokeDasharray="4,2"
                        className="pointer-events-none animate-pulse"
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {/* User Drawn Shapes */}
                <g className="user-shapes">
                    {[...userShapes, currentShape].filter(Boolean).map((shape: UserShape) => {
                        if (shape.type === 'rect') {
                            return <rect key={shape.id} x={shape.data.x} y={shape.data.y} width={shape.data.w} height={shape.data.h} stroke={shape.color} className="user-shape" />;
                        } else if (shape.type === 'circle') {
                            return <circle key={shape.id} cx={shape.data.cx} cy={shape.data.cy} r={shape.data.r} stroke={shape.color} className="user-shape" />;
                        } else if (shape.type === 'polyline') {
                            const pts = shape.data.points.map((p: any) => `${p.x},${p.y}`).join(' ');
                            return <polyline key={shape.id} points={pts} stroke={shape.color} className="user-shape" />;
                        } else if (shape.type === 'arc') {
                            const d = `M ${shape.data.p1.x} ${shape.data.p1.y} Q ${shape.data.control.x} ${shape.data.control.y} ${shape.data.p2.x} ${shape.data.p2.y}`;
                            return (
                                <g key={shape.id}>
                                    <path d={d} stroke={shape.color} fill="none" className="user-shape" />
                                    {(currentShape === shape) && (
                                        <path d={`M ${shape.data.p1.x} ${shape.data.p1.y} L ${shape.data.control.x} ${shape.data.control.y} L ${shape.data.p2.x} ${shape.data.p2.y}`} stroke="#ffffff" strokeWidth="0.5" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" opacity="0.5" />
                                    )}
                                </g>
                            );
                        }
                        return null;
                    })}
                </g>

                {/* Measurements */}
                <g className="measurements">
                    {measurements.map((m, idx) => {
                        const midX = (m.p1.x + m.p2.x) / 2;
                        const midY = (m.p1.y + m.p2.y) / 2;
                        const distStr = `${m.distance}m`;
                        const rectWidth = Math.max(2.5, distStr.length * 0.7); 
                        return (
                            <g key={idx}>
                                <line x1={m.p1.x} y1={m.p1.y} x2={m.p2.x} y2={m.p2.y} stroke="#e879f9" strokeWidth="2px" strokeDasharray="5,5" markerStart="url(#measure-dot)" markerEnd="url(#measure-dot)" className="measure-line" />
                                <rect x={midX - (rectWidth/2)} y={midY - 0.7} width={rectWidth} height="1.4" fill="#0F1218" stroke="#e879f9" strokeWidth="0.5px" rx="0.4" opacity="1" vectorEffect="non-scaling-stroke" />
                                <text x={midX} y={midY} dominantBaseline="middle" textAnchor="middle" fill="#e879f9" fontSize="0.9" fontWeight="bold" className="font-mono">{distStr}</text>
                            </g>
                        );
                    })}
                    {activeTool === 'measure' && measureStart && cursorPos && (
                        <g>
                            <line x1={measureStart.x} y1={measureStart.y} x2={cursorPos.x} y2={cursorPos.y} stroke="#e879f9" strokeWidth="2px" strokeDasharray="2,2" className="measure-line" />
                            <circle cx={measureStart.x} cy={measureStart.y} r="0.2" fill="#e879f9" />
                            <circle cx={cursorPos.x} cy={cursorPos.y} r="0.2" fill="#e879f9" />
                            <g>
                                <rect x={(measureStart.x + cursorPos.x)/2 - 2} y={(measureStart.y + cursorPos.y)/2 - 0.7} width="4" height="1.4" fill="#0F1218" stroke="#e879f9" strokeWidth="0.5px" rx="0.4" opacity="0.8" vectorEffect="non-scaling-stroke" />
                                <text x={(measureStart.x + cursorPos.x) / 2} y={(measureStart.y + cursorPos.y) / 2} dominantBaseline="middle" textAnchor="middle" fill="#e879f9" fontSize="0.9" className="font-mono">{Math.hypot(cursorPos.x - measureStart.x, cursorPos.y - measureStart.y).toFixed(2)}m</text>
                            </g>
                        </g>
                    )}
                </g>

                {/* Snapping Cursor */}
                {cursorPos && (
                    <g className="pointer-events-none">
                        <line x1={gridBounds.x} y1={cursorPos.y} x2={gridBounds.x + gridBounds.width} y2={cursorPos.y} stroke={activeTool.startsWith('draw') ? '#10b981' : (activeTool === 'measure' ? '#d946ef' : (activeTool === 'detail' ? '#6366f1' : '#22d3ee'))} strokeWidth="1px" strokeDasharray="4,4" opacity="0.6" vectorEffect="non-scaling-stroke" />
                        <line x1={cursorPos.x} y1={gridBounds.y} x2={cursorPos.x} y2={gridBounds.y + gridBounds.height} stroke={activeTool.startsWith('draw') ? '#10b981' : (activeTool === 'measure' ? '#d946ef' : (activeTool === 'detail' ? '#6366f1' : '#22d3ee'))} strokeWidth="1px" strokeDasharray="4,4" opacity="0.6" vectorEffect="non-scaling-stroke" />
                        <rect x={cursorPos.x - 0.2} y={cursorPos.y - 0.2} width="0.4" height="0.4" fill="none" stroke={activeTool.startsWith('draw') ? '#10b981' : (activeTool === 'measure' ? '#e879f9' : (activeTool === 'detail' ? '#6366f1' : '#facc15'))} strokeWidth="2px" vectorEffect="non-scaling-stroke" />
                        <text x={cursorPos.x + 0.5} y={cursorPos.y - 0.5} fill={activeTool.startsWith('draw') ? '#10b981' : (activeTool === 'measure' ? '#e879f9' : (activeTool === 'detail' ? '#6366f1' : '#facc15'))} fontSize="0.5" className="font-mono" style={{ textShadow: '0 1px 2px black' }}>{cursorPos.x.toFixed(2)}, {cursorPos.y.toFixed(2)}</text>
                    </g>
                )}
             </svg>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-6 select-none pointer-events-none">
            <div className="w-32 h-32 border border-dashed border-slate-700 rounded-full flex items-center justify-center opacity-50">
               <Move size={48} className="text-slate-700" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-mono text-sm tracking-widest uppercase">No Active Blueprint</p>
              <p className="text-xs text-slate-500 max-w-xs">Describe a structure to generate a 2D CAD prototype.</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0B0E14] border-t border-slate-800 px-4 py-1.5 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wider z-20">
        <div className="flex gap-4 min-w-[150px]">
             {activeTool === 'measure' ? (
                 <span className="text-fuchsia-400 animate-pulse">{measureStart ? 'CLICK TO END MEASUREMENT' : 'CLICK FIRST POINT'}</span>
             ) : activeTool === 'detail' ? (
                 <span className="text-indigo-400 animate-pulse">ENTER ELEMENT ID TO DETAIL</span>
             ) : activeTool === 'draw_polyline' ? (
                 <span className="text-emerald-400">CLICK TO ADD POINTS • DOUBLE-CLICK TO FINISH</span>
             ) : activeTool === 'draw_arc' ? (
                 <span className="text-emerald-400">{drawStep === 0 ? 'CLICK START POINT' : drawStep === 1 ? 'CLICK END POINT' : 'DRAG CONTROL POINT'}</span>
             ) : (
                cursorPos ? (<span>X: {cursorPos.x.toFixed(2)} Y: {cursorPos.y.toFixed(2)}</span>) : (<span>READY</span>)
             )}
             <span>MODEL SPACE</span>
        </div>
        <div className="flex gap-4 items-center">
            <button onClick={() => setSnapEnabled(!snapEnabled)} className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors ${snapEnabled ? 'bg-cyan-900/40 text-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}>
                <Crosshair size={12} />
                <span>SNAP: {snapEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <span className="text-slate-400">ORTHO: ON</span>
            <span className="text-white">ZOOM: {currentZoomPct}%</span>
        </div>
      </div>
    </div>
  );
};

export default Canvas;