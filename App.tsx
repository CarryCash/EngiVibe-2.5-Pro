import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Canvas from './components/Canvas';
import ReportPanel from './components/ReportPanel';
import ExportSection from './components/ExportSection';
import BoQPanel from './components/BoQPanel'; 
import DetailModal from './components/DetailModal'; 
import UnitConverterModal from './components/UnitConverterModal';
import { generateEngineeringDesign, generateElementDetail } from './services/geminiService';
import { Message, DesignData, AppStatus, ExportFile, StructuralDetail } from './types';
import { INITIAL_GREETING } from './constants';
import { Layout, FileOutput, PenTool, Calculator } from 'lucide-react'; 

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: INITIAL_GREETING, timestamp: new Date() }
  ]);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  
  // Design State
  const [currentDesign, setCurrentDesign] = useState<DesignData | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'report' | 'boq' | 'export'>('report'); 
  const [projectDescription, setProjectDescription] = useState('');

  // Detailing State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<StructuralDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Unit Converter State
  const [converterOpen, setConverterOpen] = useState(false);

  // 1. Core Generation Logic
  const performGeneration = async (prompt: string, siteContext?: { lat: number, lng: number }) => {
     setStatus(AppStatus.THINKING);
     try {
      const response = await generateEngineeringDesign(prompt, messages, projectDescription, siteContext);

      // Create snapshot object
      const designSnapshot: DesignData = {
        projectTitle: response.projectTitle,
        svgContent: response.svgContent,
        viewBox: response.viewBox,
        reportMarkdown: response.reportMarkdown,
        billOfQuantities: response.billOfQuantities, 
        files: response.files,
        geoLocation: response.geoLocation
      };

      const modelMsg: Message = { 
          role: 'model', 
          text: response.chatResponse, 
          timestamp: new Date(),
          designSnapshot: designSnapshot // Save snapshot
      };
      setMessages(prev => [...prev, modelMsg]);
      
      setCurrentDesign(designSnapshot);
      
      if (status !== AppStatus.THINKING) {
         setActiveRightTab('report');
      }
      setStatus(AppStatus.IDLE);

    } catch (error) {
      console.error("Design Generation Error:", error);
      const errorMsg: Message = { 
        role: 'model', 
        text: "I encountered a calculation error while processing your engineering request. Please try refining your prompt.", 
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleSendMessage = async (text: string) => {
    const COORD_REGEX = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = text.match(COORD_REGEX);

    if (match) {
        const userMsg: Message = { role: 'user', text: text, timestamp: new Date() };
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        const cardMsg: Message = { 
            role: 'model', 
            text: 'Location Detected', 
            timestamp: new Date(),
            locationRequest: {
                lat,
                lng,
                originalPrompt: text
            }
        };
        setMessages(prev => [...prev, userMsg, cardMsg]);
        return;
    }

    const userMsg: Message = { role: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    performGeneration(text);
  };

  const handleConfirmLocation = (lat: number, lng: number, prompt: string) => {
      const confirmMsg: Message = { 
          role: 'user', 
          text: `[CONFIRMED SITE LOCATION]: ${lat}, ${lng}`, 
          timestamp: new Date() 
      };
      setMessages(prev => [...prev, confirmMsg]);
      performGeneration(prompt, { lat, lng });
  };

  const handleRunAudit = () => {
      if (status !== AppStatus.IDLE) return;
      const auditPrompt = "Perform a comprehensive Code Compliance Audit (ACI 318 / ASCE 7 / Eurocode) on the current design. Highlight any structural risks, code violations, or safety concerns with '⚠️' and confirm compliant sections with '✅'. Update the Technical Report with a dedicated 'Code Validation' section.";
      
      const userMsg: Message = { role: 'user', text: auditPrompt, timestamp: new Date() };
      setMessages(prev => [...prev, userMsg]);
      performGeneration(auditPrompt);
  };

  const handleRequestDetail = async (elementId: string) => {
      setDetailModalOpen(true);
      setIsDetailLoading(true);
      setCurrentDetail({ elementId, elementType: 'Loading...', svgContent: '', specifications: [] });
      try {
          const detail = await generateElementDetail(elementId, projectDescription || currentDesign?.projectTitle || "Standard Civil Project");
          setCurrentDetail(detail);
      } catch (e) {
          console.error(e);
          setDetailModalOpen(false); 
      } finally {
          setIsDetailLoading(false);
      }
  };

  const handleRestoreSnapshot = (design: DesignData) => {
      setCurrentDesign(design);
      setActiveRightTab('report');
  };

  const handleSvgUpdate = (newContent: string) => {
      if (currentDesign) {
          setCurrentDesign({ ...currentDesign, svgContent: newContent });
      }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      
      {/* Modals Layer */}
      {detailModalOpen && (
          <DetailModal 
            detail={currentDetail} 
            isLoading={isDetailLoading} 
            onClose={() => setDetailModalOpen(false)} 
          />
      )}
      
      <UnitConverterModal 
        isOpen={converterOpen}
        onClose={() => setConverterOpen(false)}
      />

      {/* Left Panel: Chat (30%) */}
      <div className="w-[350px] shrink-0 h-full flex flex-col shadow-xl z-20">
        <ChatInterface 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          onConfirmLocation={handleConfirmLocation}
          onRestoreSnapshot={handleRestoreSnapshot}
          status={status}
          projectDescription={projectDescription}
          onProjectDescriptionChange={setProjectDescription}
        />
      </div>

      {/* Middle: Canvas (45%) */}
      <div className="flex-1 h-full flex flex-col min-w-0 bg-slate-900 relative">
        <div className="h-12 border-b border-slate-800 bg-slate-950 flex items-center px-4 justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                <PenTool size={16} />
                <span>Design Workspace</span>
            </div>
            {currentDesign && (
                 <span className="text-xs font-mono text-cyan-500 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-900">
                    SVG RENDERER ACTIVE
                 </span>
            )}
        </div>
        <div className="flex-1 p-4 overflow-hidden">
          <Canvas 
            svgContent={currentDesign?.svgContent || null} 
            viewBox={currentDesign?.viewBox || "0 0 100 100"}
            geoLocation={currentDesign?.geoLocation}
            onReqDetail={handleRequestDetail}
            onOpenConverter={() => setConverterOpen(true)}
            onSvgUpdate={handleSvgUpdate}
          />
        </div>
      </div>

      {/* Right Panel: Report, BoQ & Exports (25%) */}
      <div className="w-[400px] shrink-0 h-full flex flex-col border-l border-slate-800 bg-slate-950 shadow-xl z-10">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveRightTab('report')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeRightTab === 'report' 
              ? 'text-cyan-400 border-b-2 border-cyan-500 bg-slate-900' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
            }`}
          >
            <Layout size={16} />
            Report
          </button>
          <button 
            onClick={() => setActiveRightTab('boq')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeRightTab === 'boq' 
              ? 'text-cyan-400 border-b-2 border-cyan-500 bg-slate-900' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
            }`}
          >
            <Calculator size={16} />
            Metrados
          </button>
          <button 
            onClick={() => setActiveRightTab('export')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              activeRightTab === 'export' 
              ? 'text-cyan-400 border-b-2 border-cyan-500 bg-slate-900' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/50'
            }`}
          >
            <FileOutput size={16} />
            Exports
            {currentDesign?.files?.length ? (
                <span className="ml-1 text-[10px] bg-cyan-600 text-white px-1.5 rounded-full">
                    {currentDesign.files.length}
                </span>
            ) : null}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative p-4 bg-slate-900/50">
          {activeRightTab === 'report' && (
            <ReportPanel 
              markdown={currentDesign?.reportMarkdown || null} 
              projectTitle={currentDesign?.projectTitle}
              onRunAudit={handleRunAudit}
              isAuditing={status === AppStatus.THINKING}
            />
          )}
          
          {activeRightTab === 'boq' && (
            <BoQPanel data={currentDesign?.billOfQuantities} />
          )}

          {activeRightTab === 'export' && (
            <div className="h-full overflow-y-auto">
               {currentDesign ? (
                 <ExportSection 
                    files={currentDesign.files} 
                    billOfQuantities={currentDesign.billOfQuantities}
                    projectTitle={currentDesign.projectTitle}
                    geoLocation={currentDesign.geoLocation}
                 />
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                    <FileOutput size={32} className="opacity-50" />
                    <p className="text-sm">No export files generated yet.</p>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default App;