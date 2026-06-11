export function useLocalIp() {
  if (typeof window !== 'undefined') {
    return window.location.hostname
  }
  return ''
}
