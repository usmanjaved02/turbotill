export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

export const addHours = (date: Date, hours: number): Date => new Date(date.getTime() + hours * 60 * 60 * 1000)

export const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60 * 1000)
