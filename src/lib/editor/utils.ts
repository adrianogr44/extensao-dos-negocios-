export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function applyChromaKey(
  imageData: ImageData,
  color: [number, number, number] = [0, 0, 0],
  threshold: number = 100,
  softness: number = 20
): ImageData {
  const data = imageData.data;
  const [r, g, b] = color;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance < threshold) {
      const alpha = Math.max(0, ((distance - threshold + softness) / softness) * 255);
      data[i + 3] = Math.min(255, Math.max(0, Math.round(alpha)));
    }
  }
  return imageData;
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

export function parseSRT(content: string): SRTEntry[] {
  const entries: SRTEntry[] = [];
  const blocks = content.trim().split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;
    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );
    if (!timeMatch) continue;
    const startTime =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;
    const endTime =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;
    const text = lines.slice(2).join('\n');
    entries.push({ index, startTime, endTime, text });
  }
  return entries;
}

export function parseVTT(content: string): SRTEntry[] {
  const entries: SRTEntry[] = [];
  const blocks = content
    .substring(content.indexOf('\n\n') + 2)
    .trim()
    .split(/\n\n+/);
  for (const block of blocks) {
    const blines = block.trim().split('\n');
    let timeIdx = 0;
    while (timeIdx < blines.length && !blines[timeIdx].includes('-->')) timeIdx++;
    if (timeIdx >= blines.length) continue;
    const timeMatch = blines[timeIdx].match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
    if (!timeMatch) continue;
    const startTime =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;
    const endTime =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;
    const text = blines.slice(timeIdx + 1).join('\n');
    entries.push({ index: entries.length + 1, startTime, endTime, text });
  }
  return entries;
}

export function getTemplateCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    futebol: 'Futebol',
    noticias: 'Notícias',
    motivacional: 'Motivacional',
    curiosidades: 'Curiosidades',
    dark: 'Dark',
    personalizado: 'Personalizado',
  };
  return labels[category] || category;
}

export function getTemplateCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    futebol: '#22c55e',
    noticias: '#3b82f6',
    motivacional: '#f59e0b',
    curiosidades: '#a855f7',
    dark: '#6b7280',
    personalizado: '#ec4899',
  };
  return colors[category] || '#6b7280';
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

interface SRTEntry {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}
