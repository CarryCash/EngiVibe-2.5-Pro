export interface ExportFile {
  name: string;
  type: 'dxf' | 's2k' | 'csv' | 'txt' | 'kml';
  content: string;
  description: string;
}

export interface BoQItem {
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPriceEstimate?: number;
  remarks?: string;
}

export interface BillOfQuantities {
  items: BoQItem[];
  summary: {
    totalConcreteVolume: number;
    totalSteelWeight: number;
    totalFormworkArea: number;
  };
}

export interface GeoLocation {
  lat: number;
  lng: number;
  locationName?: string;
}

export interface StructuralDetail {
  elementId: string;
  elementType: string; // e.g. "Reinforced Concrete Column"
  svgContent: string;
  specifications: string[]; // List of reinforcement specs e.g. "4 Ø 1/2'' Longitudinal"
}

export interface DesignData {
  projectTitle: string;
  svgContent: string;
  viewBox: string;
  reportMarkdown: string;
  files: ExportFile[];
  billOfQuantities: BillOfQuantities;
  geoLocation?: GeoLocation | null;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
  locationRequest?: {
    lat: number;
    lng: number;
    originalPrompt: string;
  };
  designSnapshot?: DesignData; // New field to store the state version
}

export enum AppStatus {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  GENERATING = 'GENERATING',
  ERROR = 'ERROR'
}

export interface ChatState {
  messages: Message[];
  status: AppStatus;
}