export interface Video {
  id: string
  filename: string
  filepath: string
  duration: number
  status: 'pending' | 'posted' | 'error'
  createdAt: string
}

export interface ScheduleConfig {
  enabled: boolean
  timesPerDay: number
  intervalMinutes: number
  startTime: string
  endTime: string
  daysOfWeek: number[]
}

export interface InstagramConfig {
  username: string
  password: string
  proxy?: string
}

export interface OverlayConfig {
  text: string
  fontSize: number
  fontColor: string
  position: 'top' | 'bottom' | 'center'
  backgroundColor: string
}
