/*
* fnOS theme prelude.
*
* This file is intentionally kept outside the lazy CJS factory. DSH fetches
* `immediately` client bundles before it creates the client plugin entries;
* installing matchMedia here lets ui-theme see the fnOS-backed media query on
* its first construction. The rest of the bridge is exposed through one
* page-local object and consumed by the plugin apply function.
*/
(() => {
	const root = globalThis;
	if (root.__DSH_FNOS_THEME_BRIDGE__?.version === 1) return;
	const DARK_QUERY = "(prefers-color-scheme: dark)";
	const SDK_URL = "/app/fn-deepseek-harness/trim-web-app.js";
	const nativeMatchMedia = typeof window === "object" && typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
	const nativeDarkMedia = nativeMatchMedia?.(DARK_QUERY) ?? null;
	const mediaListeners = /* @__PURE__ */ new Set();
	const themeSubscribers = /* @__PURE__ */ new Set();
	let mediaOnChange = null;
	let activeTheme = null;
	let connectionStarted = false;
	let connectionStop = null;
	let connectionGeneration = 0;
	function callMediaListener(listener, event) {
		if (typeof listener === "function") listener.call(bridgedDarkMedia, event);
		else listener?.handleEvent?.(event);
	}
	const bridgedDarkMedia = {
		get matches() {
			return activeTheme === "dark" || activeTheme === null && nativeDarkMedia?.matches === true;
		},
		media: DARK_QUERY,
		get onchange() {
			return mediaOnChange;
		},
		set onchange(listener) {
			mediaOnChange = listener;
		},
		addEventListener(type, listener) {
			if (type === "change" && listener) mediaListeners.add(listener);
		},
		removeEventListener(type, listener) {
			if (type === "change") mediaListeners.delete(listener);
		},
		addListener(listener) {
			if (listener) mediaListeners.add(listener);
		},
		removeListener(listener) {
			mediaListeners.delete(listener);
		},
		dispatchEvent(event) {
			mediaListeners.forEach((listener) => callMediaListener(listener, event));
			callMediaListener(mediaOnChange, event);
			return true;
		}
	};
	function installMatchMediaBridge() {
		if (!nativeMatchMedia || !nativeDarkMedia || typeof window !== "object" || typeof window.matchMedia !== "function") return;
		window.matchMedia = (query) => query === DARK_QUERY ? bridgedDarkMedia : nativeMatchMedia(query);
	}
	function dispatchThemeChange() {
		if (typeof window === "undefined") return;
		const event = typeof window.MediaQueryListEvent === "function" ? new window.MediaQueryListEvent("change", {
			matches: bridgedDarkMedia.matches,
			media: DARK_QUERY
		}) : new Event("change");
		bridgedDarkMedia.dispatchEvent(event);
	}
	function normalizeTheme(value) {
		if (value === "dark" || value === "light") return value;
		if (Array.isArray(value)) return normalizeTheme(value[0]);
		if (!value || typeof value !== "object") return null;
		return normalizeTheme(value.theme ?? value.nightMode ?? value.mode ?? value.value ?? value.detail ?? value.data);
	}
	function setTheme(...values) {
		const theme = values.map(normalizeTheme).find(Boolean);
		if (theme !== "dark" && theme !== "light") return false;
		if (activeTheme === theme) return true;
		activeTheme = theme;
		dispatchThemeChange();
		return true;
	}
	function setThemeAndNotify(...values) {
		const changed = setTheme(...values);
		if (changed) for (const listener of [...themeSubscribers]) try {
			listener(activeTheme);
		} catch (error) {
			console.warn("[dsh-fnos] theme subscriber failed", error);
		}
		return changed;
	}
	async function connect() {
		if (connectionStarted) return connectionStop ?? (() => {});
		const generation = ++connectionGeneration;
		connectionStarted = true;
		try {
			const module = await import(
				/* @vite-ignore */
				SDK_URL
);
			const TrimApp = module.TrimApp ?? module.default;
			if (typeof TrimApp !== "function") throw new TypeError("TrimApp export is unavailable");
			const sdk = new TrimApp();
			if (sdk.isWeb !== true || sdk.isStandaloneWeb === true) {
				if (generation === connectionGeneration) connectionStarted = false;
				return () => {};
			}
			const config = await sdk.getPlatformConfig();
			if (generation !== connectionGeneration) return () => {};
			setThemeAndNotify(config);
			const handleThemeEvent = (...values) => {
				if (generation !== connectionGeneration) return;
				setThemeAndNotify(...values);
			};
			await sdk.$on("os/theme", handleThemeEvent);
			if (generation !== connectionGeneration) {
				await sdk.$off?.("os/theme", handleThemeEvent);
				return () => {};
			}
			connectionStop = async () => {
				if (connectionStop === null) return;
				connectionStop = null;
				connectionStarted = false;
				connectionGeneration += 1;
				await sdk.$off?.("os/theme", handleThemeEvent);
			};
			return connectionStop;
		} catch (error) {
			if (generation === connectionGeneration) connectionStarted = false;
			console.debug("[dsh-fnos] fnOS theme bridge unavailable", error);
			return () => {};
		}
	}
	installMatchMediaBridge();
	root.__DSH_FNOS_THEME_BRIDGE__ = {
		version: 1,
		media: bridgedDarkMedia,
		getTheme: () => activeTheme,
		subscribe(listener) {
			themeSubscribers.add(listener);
			return () => themeSubscribers.delete(listener);
		},
		connect,
		disconnect() {
			connectionGeneration += 1;
			if (connectionStop !== null) return connectionStop();
			connectionStarted = false;
			return Promise.resolve();
		}
	};
})();
window.__ModuleLoader__.load({
	id: "@tnnevol/dsh-fnos",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		const name = "dsh-fnos-plugin-client";
		const inject = ["theme"];
		const DARK_ATTRIBUTE = "data-ds-dark-theme";
		let systemFallbackActive = false;
		let previousColorScheme;
		let previousDarkAttribute;
		function applySystemTheme(theme) {
			if (theme === null || typeof document === "undefined") return;
			if (!systemFallbackActive) {
				previousColorScheme = document.documentElement.style.colorScheme;
				previousDarkAttribute = document.body?.hasAttribute(DARK_ATTRIBUTE);
			}
			const dark = theme === "dark";
			document.documentElement.style.colorScheme = dark ? "dark" : "light";
			document.body?.toggleAttribute(DARK_ATTRIBUTE, dark);
			systemFallbackActive = true;
		}
		function clearSystemThemeFallback() {
			if (!systemFallbackActive || typeof document === "undefined") return;
			if (previousColorScheme === "") document.documentElement.style.removeProperty("color-scheme");
			else if (previousColorScheme !== void 0) document.documentElement.style.colorScheme = previousColorScheme;
			if (previousDarkAttribute === true) document.body?.setAttribute(DARK_ATTRIBUTE, "");
			else if (previousDarkAttribute === false) document.body?.removeAttribute(DARK_ATTRIBUTE);
			previousColorScheme = void 0;
			previousDarkAttribute = void 0;
			systemFallbackActive = false;
		}
		/**
		* DSH rc.7 exposes the theme registry as a service but does not expose a
		* public "re-resolve system preference" method. The bridge uses the existing
		* media slot plus the runtime's publish seam when present, and always keeps a
		* direct DOM fallback for a future incompatible runtime.
		*/
		function refreshSystemTheme(ctx, bridge) {
			const theme = ctx.theme;
			if (theme.getTheme().preference !== "system") {
				clearSystemThemeFallback();
				return;
			}
			const runtime = theme;
			if (runtime.media !== bridge.media) runtime.media = bridge.media;
			runtime.publish?.();
			applySystemTheme(bridge.getTheme());
		}
		function apply(ctx) {
			const bridge = globalThis.__DSH_FNOS_THEME_BRIDGE__;
			if (bridge === void 0) return;
			const runtime = ctx.theme;
			const previousMedia = runtime.media;
			const unsubscribe = bridge.subscribe(() => {
				refreshSystemTheme(ctx, bridge);
			});
			const offThemeChange = ctx.on("theme/change", () => {
				refreshSystemTheme(ctx, bridge);
			});
			ctx.effect(() => {
				runtime.media = bridge.media;
				refreshSystemTheme(ctx, bridge);
				bridge.connect().catch((error) => {
					console.debug("[dsh-fnos] unable to connect to fnOS theme events", error);
				});
				return async () => {
					unsubscribe();
					offThemeChange();
					await bridge.disconnect();
					clearSystemThemeFallback();
					if (runtime.media === bridge.media) {
						if (previousMedia === void 0) delete runtime.media;
						else runtime.media = previousMedia;
					}
				};
			}, "dsh-fnos: fnOS theme bridge");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map