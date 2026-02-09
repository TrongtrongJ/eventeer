export function formatEventDate (dateString: string) {
  return new Date(dateString).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  })
}