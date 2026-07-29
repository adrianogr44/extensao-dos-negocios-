'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  EditorProject,
  EditorElement,
  Caption,
  Template,
  MediaItem,
  BatchJob,
  AutomationDataSource,
  ExportSettings,
  SmartGuide,
} from './types';

interface EditorState {
  project: EditorProject | null;
  selectedElementIds: string[];
  selectedCaptionId: string | null;
  templates: Template[];
  mediaLibrary: MediaItem[];
  batchJobs: BatchJob[];
  exportSettings: ExportSettings;
  smartGuides: SmartGuide[];
  currentTime: number;
  isPlaying: boolean;
  zoom: number;
  panOffset: { x: number; y: number };
  panelWidths: {
    left: number;
    right: number;
    timeline: number;
  };
  clipboard: EditorElement | null;
  history: EditorProject[];
  historyIndex: number;
  isDirty: boolean;

  setProject: (project: EditorProject) => void;
  updateProject: (updates: Partial<EditorProject>) => void;
  addElement: (element: Omit<EditorElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<EditorElement>) => void;
  removeElement: (id: string) => void;
  duplicateElements: (ids: string[]) => void;
  setSelectedElements: (ids: string[]) => void;
  selectElement: (id: string) => void;
  deselectAll: () => void;
  reorderElement: (id: string, newIndex: number) => void;

  addCaption: (caption: Omit<Caption, 'id'>) => void;
  updateCaption: (id: string, updates: Partial<Caption>) => void;
  removeCaption: (id: string) => void;
  setSelectedCaption: (id: string | null) => void;
  importCaptions: (captions: Omit<Caption, 'id'>[]) => void;

  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setPanelWidth: (panel: 'left' | 'right' | 'timeline', width: number) => void;

  addTemplate: (template: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  removeTemplate: (id: string) => void;
  applyTemplate: (templateId: string) => void;
  saveAsTemplate: (name: string, category: Template['category']) => void;

  addMediaItem: (item: Omit<MediaItem, 'id' | 'createdAt'>) => void;
  removeMediaItem: (id: string) => void;

  addBatchJob: (job: Omit<BatchJob, 'id' | 'createdAt' | 'progress' | 'completedItems' | 'errors'>) => void;
  updateBatchJob: (id: string, updates: Partial<BatchJob>) => void;
  removeBatchJob: (id: string) => void;

  setAutomationData: (data: AutomationDataSource) => void;

  copySelected: () => void;
  pasteClipboard: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

const createDefaultProject = (): EditorProject => ({
  id: uuidv4(),
  name: 'Novo Projeto',
  width: 1080,
  height: 1920,
  duration: 30,
  elements: [],
  captions: [],
  removeOverlayBlack: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createDefaultProject(),
  selectedElementIds: [],
  selectedCaptionId: null,
  templates: [],
  mediaLibrary: [],
  batchJobs: [],
  exportSettings: {
    format: 'mp4',
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    quality: 'high',
    parallelJobs: 2,
  },
  smartGuides: [],
  currentTime: 0,
  isPlaying: false,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  panelWidths: {
    left: 320,
    right: 340,
    timeline: 200,
  },
  clipboard: null,
  history: [],
  historyIndex: -1,
  isDirty: false,

  setProject: (project) => set({ project, isDirty: true }),

  updateProject: (updates) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: { ...state.project, ...updates, updatedAt: Date.now() },
        isDirty: true,
      };
    }),

  addElement: (element) => {
    const newElement: EditorElement = { ...element, id: uuidv4() };
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          elements: [...state.project.elements, newElement],
          updatedAt: Date.now(),
        },
        selectedElementIds: [newElement.id],
        isDirty: true,
      };
    });
    get().pushHistory();
  },

  updateElement: (id, updates) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            el.id === id ? { ...el, ...updates } : el
          ),
          updatedAt: Date.now(),
        },
        isDirty: true,
      };
    }),

  removeElement: (id) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          elements: state.project.elements.filter((el) => el.id !== id),
          updatedAt: Date.now(),
        },
        selectedElementIds: state.selectedElementIds.filter((eid) => eid !== id),
        isDirty: true,
      };
    });
    get().pushHistory();
  },

  duplicateElements: (ids) => {
    set((state) => {
      if (!state.project) return state;
      const elementsToDup = state.project.elements.filter((el) => ids.includes(el.id));
      const newElements = elementsToDup.map((el) => ({
        ...el,
        id: uuidv4(),
        x: el.x + 20,
        y: el.y + 20,
        name: `${el.name} (cópia)`,
      }));
      return {
        project: {
          ...state.project,
          elements: [...state.project.elements, ...newElements],
          updatedAt: Date.now(),
        },
        selectedElementIds: newElements.map((el) => el.id),
        isDirty: true,
      };
    });
    get().pushHistory();
  },

  setSelectedElements: (ids) => set({ selectedElementIds: ids }),
  selectElement: (id) => set({ selectedElementIds: [id] }),
  deselectAll: () => set({ selectedElementIds: [], selectedCaptionId: null }),

  reorderElement: (id, newIndex) =>
    set((state) => {
      if (!state.project) return state;
      const elements = [...state.project.elements];
      const currentIndex = elements.findIndex((el) => el.id === id);
      if (currentIndex === -1) return state;
      const [element] = elements.splice(currentIndex, 1);
      elements.splice(newIndex, 0, element);
      return {
        project: { ...state.project, elements, updatedAt: Date.now() },
        isDirty: true,
      };
    }),

  addCaption: (caption) =>
    set((state) => {
      if (!state.project) return state;
      const newCaption: Caption = { ...caption, id: uuidv4() };
      return {
        project: {
          ...state.project,
          captions: [...state.project.captions, newCaption],
          updatedAt: Date.now(),
        },
        selectedCaptionId: newCaption.id,
        isDirty: true,
      };
    }),

  updateCaption: (id, updates) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          captions: state.project.captions.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
          updatedAt: Date.now(),
        },
        isDirty: true,
      };
    }),

  removeCaption: (id) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          captions: state.project.captions.filter((c) => c.id !== id),
          updatedAt: Date.now(),
        },
        selectedCaptionId:
          state.selectedCaptionId === id ? null : state.selectedCaptionId,
        isDirty: true,
      };
    }),

  setSelectedCaption: (id) => set({ selectedCaptionId: id }),

  importCaptions: (captions) =>
    set((state) => {
      if (!state.project) return state;
      const newCaptions = captions.map((c) => ({ ...c, id: uuidv4() }));
      return {
        project: {
          ...state.project,
          captions: [...state.project.captions, ...newCaptions],
          updatedAt: Date.now(),
        },
        isDirty: true,
      };
    }),

  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom }),
  setPanOffset: (offset) => set({ panOffset: offset }),
  setPanelWidth: (panel, width) =>
    set((state) => ({
      panelWidths: { ...state.panelWidths, [panel]: width },
    })),

  addTemplate: (template) =>
    set((state) => ({
      templates: [
        ...state.templates,
        {
          ...template,
          id: uuidv4(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          usageCount: 0,
        },
      ],
    })),

  updateTemplate: (id, updates) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
      ),
    })),

  removeTemplate: (id) =>
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    })),

  applyTemplate: (templateId) => {
    const state = get();
    const template = state.templates.find((t) => t.id === templateId);
    if (!template || !state.project) return;

    const newElements = template.elements.map((el) => ({
      ...el,
      id: uuidv4(),
    }));
    const newCaptions = template.captions.map((c) => ({
      ...c,
      id: uuidv4(),
    }));

    set({
      project: {
        ...state.project,
        elements: newElements,
        captions: newCaptions,
        overlayUrl: template.overlayConfig.url,
        removeOverlayBlack: template.overlayConfig.removeBlack,
        updatedAt: Date.now(),
      },
      selectedElementIds: [],
      isDirty: true,
    });

    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t
      ),
    }));
    get().pushHistory();
  },

  saveAsTemplate: (name, category) => {
    const state = get();
    if (!state.project) return;
    const template: Template = {
      id: uuidv4(),
      name,
      description: '',
      category,
      elements: state.project.elements,
      captions: state.project.captions,
      overlayConfig: {
        url: state.project.overlayUrl,
        removeBlack: state.project.removeOverlayBlack,
      },
      videoConfig: {
        position: { x: 0, y: 0 },
        scale: 1,
      },
      textStyles: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };
    set((state) => ({
      templates: [...state.templates, template],
    }));
  },

  addMediaItem: (item) =>
    set((state) => ({
      mediaLibrary: [
        ...state.mediaLibrary,
        { ...item, id: uuidv4(), createdAt: Date.now() },
      ],
    })),

  removeMediaItem: (id) =>
    set((state) => ({
      mediaLibrary: state.mediaLibrary.filter((m) => m.id !== id),
    })),

  addBatchJob: (job) =>
    set((state) => ({
      batchJobs: [
        ...state.batchJobs,
        {
          ...job,
          id: uuidv4(),
          createdAt: Date.now(),
          progress: 0,
          completedItems: 0,
          errors: [],
        },
      ],
    })),

  updateBatchJob: (id, updates) =>
    set((state) => ({
      batchJobs: state.batchJobs.map((j) =>
        j.id === id ? { ...j, ...updates } : j
      ),
    })),

  removeBatchJob: (id) =>
    set((state) => ({
      batchJobs: state.batchJobs.filter((j) => j.id !== id),
    })),

  setAutomationData: (data) =>
    set((state) => ({
      batchJobs: state.batchJobs.map((j, i) =>
        i === 0 ? { ...j, dataSource: data } : j
      ),
    })),

  copySelected: () => {
    const state = get();
    if (state.selectedElementIds.length === 0) return;
    const elements = state.project?.elements.filter((el) =>
      state.selectedElementIds.includes(el.id)
    );
    if (elements && elements.length > 0) {
      set({ clipboard: elements[0] });
    }
  },

  pasteClipboard: () => {
    const state = get();
    if (!state.clipboard || !state.project) return;
    const newElement: EditorElement = {
      ...state.clipboard,
      id: uuidv4(),
      x: state.clipboard.x + 30,
      y: state.clipboard.y + 30,
    };
    set({
      project: {
        ...state.project,
        elements: [...state.project.elements, newElement],
        updatedAt: Date.now(),
      },
      selectedElementIds: [newElement.id],
      isDirty: true,
    });
    get().pushHistory();
  },

  pushHistory: () => {
    const state = get();
    if (!state.project) return;
    const history = state.history.slice(0, state.historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(state.project)));
    if (history.length > 50) history.shift();
    set({ history, historyIndex: history.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) return;
    const project = state.history[state.historyIndex];
    set({
      project: JSON.parse(JSON.stringify(project)),
      historyIndex: state.historyIndex - 1,
      isDirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 2) return;
    const project = state.history[state.historyIndex + 2];
    set({
      project: JSON.parse(JSON.stringify(project)),
      historyIndex: state.historyIndex + 1,
      isDirty: true,
    });
  },
}));
