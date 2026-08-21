/** Browser-host detection shared without importing the browser SDK module. */

export function isEmbeddedFnosFrame(): boolean {
  return typeof window !== 'undefined' && window.parent !== window
}

export function shouldForceWebCarrier(userAgent: string, embedded: boolean): boolean {
  return embedded && /FNAppVer\//iu.test(userAgent)
}
