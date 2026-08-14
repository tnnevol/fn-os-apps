import { TrimApp } from './trim-web-app.js'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const THEME_REFRESH_INTERVAL = 5000
const nativeMatchMedia = typeof window.matchMedia === 'function'
    ? window.matchMedia.bind(window)
    : null
const nativeDarkMedia = nativeMatchMedia?.(DARK_QUERY) || null
const mediaListeners = new Set()
let mediaOnChange = null
let activeTheme = null

function callMediaListener(listener, event) {
    if (typeof listener === 'function') listener.call(bridgedDarkMedia, event)
    else listener?.handleEvent?.(event)
}

// dsh resolves its `system` preference through this media query. Keep the
// bridge limited to the query so dsh remains the DOM authority: explicit
// `light`/`dark` selections must not be overwritten by the NAS theme.
const bridgedDarkMedia = {
    get matches() {
        return activeTheme === 'dark' || (activeTheme === null && nativeDarkMedia?.matches === true)
    },
    media: DARK_QUERY,
    get onchange() {
        return mediaOnChange
    },
    set onchange(listener) {
        mediaOnChange = listener
    },
    addEventListener(type, listener) {
        if (type === 'change' && listener) mediaListeners.add(listener)
    },
    removeEventListener(type, listener) {
        if (type === 'change') mediaListeners.delete(listener)
    },
    addListener(listener) {
        if (listener) mediaListeners.add(listener)
    },
    removeListener(listener) {
        mediaListeners.delete(listener)
    },
    dispatchEvent(event) {
        mediaListeners.forEach((listener) => callMediaListener(listener, event))
        callMediaListener(mediaOnChange, event)
        return true
    }
}

function installMatchMediaBridge() {
    if (!nativeMatchMedia || !nativeDarkMedia) return
    window.matchMedia = (query) => query === DARK_QUERY
        ? bridgedDarkMedia
        : nativeMatchMedia(query)
}

function dispatchThemeChange() {
    const event = typeof window.MediaQueryListEvent === 'function'
        ? new window.MediaQueryListEvent('change', {
            matches: bridgedDarkMedia.matches,
            media: DARK_QUERY
        })
        : new Event('change')
    bridgedDarkMedia.dispatchEvent(event)
}

function normalizeTheme(value) {
    if (value === 'dark' || value === 'light') return value
    if (Array.isArray(value)) return normalizeTheme(value[0])
    if (!value || typeof value !== 'object') return null

    return normalizeTheme(
        value.theme
        ?? value.nightMode
        ?? value.mode
        ?? value.value
        ?? value.detail
        ?? value.data
    )
}

function applyTheme(...values) {
    const theme = values.map(normalizeTheme).find(Boolean)
    if (theme !== 'dark' && theme !== 'light') return false
    const changed = activeTheme !== theme
    activeTheme = theme
    if (changed) dispatchThemeChange()
    return true
}

async function connectToFnOSTheme() {
    const sdk = new TrimApp()
    if (!sdk.isWeb || sdk.isStandaloneWeb) return

    try {
        const config = await sdk.getPlatformConfig()
        applyTheme(config)
        let eventReceived = false
        let refreshInFlight = false
        let fallbackTimer = null

        const stopFallback = () => {
            if (fallbackTimer === null) return
            window.clearInterval(fallbackTimer)
            fallbackTimer = null
        }

        const handleThemeEvent = (...values) => {
            if (!applyTheme(...values)) return
            eventReceived = true
            stopFallback()
        }

        await sdk.$on('os/theme', handleThemeEvent)

        const refreshTheme = async () => {
            if (eventReceived || refreshInFlight) return
            refreshInFlight = true
            try {
                applyTheme(await sdk.getPlatformConfig())
            } catch {
                // The SDK event remains the primary path; retry on the next interval.
            } finally {
                refreshInFlight = false
            }
        }

        fallbackTimer = window.setInterval(refreshTheme, THEME_REFRESH_INTERVAL)
        window.addEventListener('focus', refreshTheme)
        document.addEventListener('visibilitychange', refreshTheme)
        if (eventReceived) stopFallback()
    } catch (error) {
        console.warn('[fn-deepseek-harness] fnOS theme bridge unavailable', error)
    }
}

installMatchMediaBridge()
void connectToFnOSTheme()
