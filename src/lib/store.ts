import { ScheduleConfig, InstagramConfig, OverlayConfig } from './types'

const STORE_KEYS = {
  SCHEDULE: 'fabrica_schedule',
  INSTAGRAM: 'fabrica_instagram',
  OVERLAY: 'fabrica_overlay',
  VIDEOS: 'fabrica_videos',
  QUEUE: 'fabrica_queue',
}

export function getSchedule(): ScheduleConfig {
  if (typeof window === 'undefined') return defaultSchedule()
  const data = localStorage.getItem(STORE_KEYS.SCHEDULE)
  return data ? JSON.parse(data) : defaultSchedule()
}

export function setSchedule(config: ScheduleConfig) {
  localStorage.setItem(STORE_KEYS.SCHEDULE, JSON.stringify(config))
}

export function getInstagram(): InstagramConfig {
  if (typeof window === 'undefined') return { username: '', password: '' }
  const data = localStorage.getItem(STORE_KEYS.INSTAGRAM)
  return data ? JSON.parse(data) : { username: '', password: '' }
}

export function setInstagram(config: InstagramConfig) {
  localStorage.setItem(STORE_KEYS.INSTAGRAM, JSON.stringify(config))
}

export function getOverlay(): OverlayConfig {
  if (typeof window === 'undefined') return defaultOverlay()
  const data = localStorage.getItem(STORE_KEYS.OVERLAY)
  return data ? JSON.parse(data) : defaultOverlay()
}

export function setOverlay(config: OverlayConfig) {
  localStorage.setItem(STORE_KEYS.OVERLAY, JSON.stringify(config))
}

function defaultSchedule(): ScheduleConfig {
  return {
    enabled: false,
    timesPerDay: 5,
    intervalMinutes: 60,
    startTime: '08:00',
    endTime: '18:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  }
}

function defaultOverlay(): OverlayConfig {
  return {
    text: '',
    fontSize: 24,
    fontColor: '#FFFFFF',
    position: 'bottom',
    backgroundColor: 'rgba(0,0,0,0.5)',
  }
}
