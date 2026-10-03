import { appConfig } from './config'

export function formatCurrency(
  amount: number,
  currency: string = appConfig.currency,
): string {
  return new Intl.NumberFormat(appConfig.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat(appConfig.locale).format(amount)
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(appConfig.locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(appConfig.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
