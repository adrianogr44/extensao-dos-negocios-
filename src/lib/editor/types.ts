export interface EditorProject {
  id: string;
  name: string;
  videoUrl?: string;
  overlayUrl?: string;
  removeOverlayBlack: boolean;
  width: number;
  height: number;
  duration: number;
  elements: EditorElement[];
  captions: Caption[];
  createdAt: number;
  updatedAt: number;
}

export interface EditorElement {
  id: string;
  type: 'video' | 'overlay' | 'image' | 'text' | 'profile' | 'handle' | 'stats';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  startTime: number;
  endTime: number;
  src?: string;
  content?: string;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: CanvasTextAlign;
  stroke?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  cornerRadius?: number;
  clipSrc?: string;
  filters?: ElementFilter[];
}

export interface ElementFilter {
  type: 'chromaKey' | 'brightness' | 'contrast' | 'saturate' | 'blur';
  value: number | ChromaKeyConfig;
}

export interface ChromaKeyConfig {
  color: string;
  threshold: number;
  softness: number;
}

export interface Caption {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  backgroundColor?: string;
  backgroundOpacity?: number;
  animation: CaptionAnimation;
  alignment: 'left' | 'center' | 'right';
}

export type CaptionAnimation = 'none' | 'fade' | 'slideUp' | 'slideDown' | 'typewriter' | 'scale';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  elements: EditorElement[];
  captions: Caption[];
  overlayConfig: {
    url?: string;
    removeBlack: boolean;
    chromaKey?: ChromaKeyConfig;
  };
  videoConfig: {
    position: { x: number; y: number };
    scale: number;
    crop?: { x: number; y: number; width: number; height: number };
  };
  profileConfig?: {
    position: { x: number; y: number };
    size: number;
  };
  textStyles: Record<string, Partial<EditorElement>>;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export type TemplateCategory = 'futebol' | 'noticias' | 'motivacional' | 'curiosidades' | 'dark' | 'personalizado';

export interface MediaItem {
  id: string;
  type: 'video' | 'image' | 'overlay' | 'audio' | 'font' | 'logo' | 'profile';
  name: string;
  url: string;
  thumbnail?: string;
  size: number;
  createdAt: number;
  folder?: string;
  tags?: string[];
}

export interface BatchJob {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  templateId: string;
  inputVideos: string[];
  dataSource?: AutomationDataSource;
  progress: number;
  totalItems: number;
  completedItems: number;
  outputDir?: string;
  createdAt: number;
  errors: string[];
}

export interface AutomationDataSource {
  type: 'csv' | 'excel';
  columns: string[];
  rows: AutomationRow[];
  mapping: Record<string, string>;
}

export interface AutomationRow {
  [key: string]: string;
}

export interface ExportSettings {
  format: 'mp4' | 'mov' | 'gif';
  resolution: { width: number; height: number };
  fps: number;
  quality: 'low' | 'medium' | 'high';
  parallelJobs: number;
}

export interface SmartGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'overlay' | 'caption' | 'audio' | 'image';
  elements: TimelineElement[];
  visible: boolean;
  locked: boolean;
}

export interface TimelineElement {
  id: string;
  elementId: string;
  startTime: number;
  endTime: number;
  name: string;
  color: string;
}

export interface SRTEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

export interface OverlayTemplate {
  id: string;
  name: string;
  category: 'twitter' | 'instagram' | 'tiktok' | 'youtube' | 'futebol' | 'noticias' | 'motivacional';
  thumbnail?: string;
  elements: OverlayElement[];
}

export type OverlayElementType = 'avatar' | 'display_name' | 'username' | 'verified' | 'video_area' | 'top_bar' | 'bottom_bar' | 'stats' | 'custom_text';

export interface OverlayElement {
  id: string;
  type: OverlayElementType;
  label: string;
  editable: boolean;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  mask?: 'circle' | 'rounded' | 'none';
  font?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  icon?: string;
  iconColor?: string;
  scale?: number;
  rotation?: number;
  content?: string;
  imageUrl?: string;
  backgroundColor?: string;
  opacity?: number;
  borderRadius?: number;
}

export const OVERLAY_PRESETS: Record<string, { elements: OverlayElement[] }> = {
  'twitter-profile': {
    elements: [
      { id: 'avatar', type: 'avatar', label: 'Avatar', editable: true, visible: true, x: 60, y: 60, width: 120, height: 120, mask: 'circle', scale: 1, rotation: 0, borderRadius: 60, color: '#555555' },
      { id: 'display_name', type: 'display_name', label: 'Nome', editable: true, visible: true, x: 210, y: 70, width: 400, height: 48, font: 'Poppins', fontSize: 42, fontWeight: '700', color: '#FFFFFF', content: 'Nome' },
      { id: 'verified', type: 'verified', label: 'Selo', editable: true, visible: true, x: 640, y: 72, width: 38, height: 38, icon: 'verified', iconColor: '#1D9BF0' },
      { id: 'username', type: 'username', label: '@Username', editable: true, visible: true, x: 210, y: 118, width: 400, height: 36, font: 'Poppins', fontSize: 32, fontWeight: '400', color: '#A8A8A8', content: '@username' },
      { id: 'video_area', type: 'video_area', label: 'Área do vídeo', editable: false, visible: true, x: 0, y: 0, width: 1080, height: 1920 },
    ],
  },

};
