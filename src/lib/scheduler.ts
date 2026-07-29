import cron, { ScheduledTask } from 'node-cron'
import { ScheduleConfig } from './types'

const activeJobs: ScheduledTask[] = []

export function startScheduler(config: ScheduleConfig, onTick: () => Promise<void>) {
  stopScheduler()

  if (!config.enabled) return

  const [startH, startM] = config.startTime.split(':').map(Number)
  const [endH, endM] = config.endTime.split(':').map(Number)
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM)

  if (totalMinutes <= 0 || config.timesPerDay <= 0) return

  const interval = Math.floor(totalMinutes / config.timesPerDay)

  for (let i = 0; i < config.timesPerDay; i++) {
    const minutes = startH * 60 + startM + i * interval
    const h = Math.floor(minutes / 60)
    const m = minutes % 60

    const days = config.daysOfWeek.join(',')

    const job = cron.schedule(`${m} ${h} * * ${days}`, async () => {
      await onTick()
    })

    activeJobs.push(job)
  }
}

export function stopScheduler() {
  activeJobs.forEach((job) => job.stop())
  activeJobs.length = 0
}

export function isSchedulerRunning(): boolean {
  return activeJobs.length > 0
}
