var youtube = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/define-content-script.mjs
	function defineContentScript(definition) {
		return definition;
	}
	//#endregion
	//#region src/lib/youtube.ts
	function extractShortsFromPage() {
		const shorts = [];
		const links = document.querySelectorAll("a[href*=\"/shorts/\"]");
		const seen = /* @__PURE__ */ new Set();
		links.forEach((link) => {
			const match = link.href.match(/\/shorts\/([^/?&]+)/);
			if (!match) return;
			const shortcode = match[1];
			if (seen.has(shortcode)) return;
			seen.add(shortcode);
			shorts.push({
				shortcode,
				videoUrl: `https://www.youtube.com/shorts/${shortcode}`,
				thumbnailUrl: void 0
			});
		});
		return shorts;
	}
	function extractProfileInfo() {
		const username = window.location.pathname.split("/").filter(Boolean)[0]?.replace("@", "") || "";
		return {
			username,
			fullName: document.querySelector("meta[property=\"og:title\"]")?.content?.replace(" - YouTube", "") || username,
			avatarUrl: document.querySelector("meta[property=\"og:image\"]")?.content || void 0
		};
	}
	function isShortsPage() {
		return window.location.pathname.includes("/shorts");
	}
	function isChannelPage() {
		const parts = window.location.pathname.split("/").filter(Boolean);
		return parts.some((p) => p.startsWith("@")) && !parts.includes("shorts");
	}
	//#endregion
	//#region src/lib/types.ts
	var DEFAULT_CONFIG = {
		apiUrl: "http://localhost:3000",
		minioEndpoint: "http://localhost:9000",
		minioAccessKey: "minioadmin",
		minioSecretKey: "minioadmin",
		minioBucket: "postreels-downloads",
		concurrency: 3,
		scrollDelay: 1500,
		maxScrolls: 50,
		maxDownloads: 20
	};
	//#endregion
	//#region entrypoints/youtube.content.ts
	var youtube_content_default = defineContentScript({
		matches: ["https://www.youtube.com/*"],
		main() {
			let downloadButton = null;
			let isScanning = false;
			function createButton() {
				if (downloadButton) return;
				downloadButton = document.createElement("div");
				downloadButton.id = "postreels-download-btn";
				downloadButton.textContent = "Baixar Shorts";
				Object.assign(downloadButton.style, {
					position: "fixed",
					bottom: "24px",
					right: "24px",
					zIndex: "999999",
					padding: "12px 20px",
					background: "linear-gradient(135deg, #ff4e50 0%, #f9d423 100%)",
					color: "#fff",
					border: "none",
					borderRadius: "12px",
					fontSize: "14px",
					fontWeight: "600",
					cursor: "pointer",
					boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
					transition: "transform 0.2s, box-shadow 0.2s",
					fontFamily: "system-ui, sans-serif"
				});
				downloadButton.addEventListener("mouseenter", () => {
					if (downloadButton) {
						downloadButton.style.transform = "scale(1.05)";
						downloadButton.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)";
					}
				});
				downloadButton.addEventListener("mouseleave", () => {
					if (downloadButton) {
						downloadButton.style.transform = "scale(1)";
						downloadButton.style.boxShadow = "0 8px 32px rgba(0,0,0,0.3)";
					}
				});
				downloadButton.addEventListener("click", handleDownload);
				document.body.appendChild(downloadButton);
			}
			async function handleDownload() {
				if (isScanning) return;
				isScanning = true;
				if (downloadButton) downloadButton.textContent = "Escaneando...";
				try {
					const storage = await chrome.storage.sync.get(DEFAULT_CONFIG);
					({
						...DEFAULT_CONFIG,
						...storage
					});
					const shorts = extractShortsFromPage();
					const shortcodes = shorts.map((s) => s.shortcode);
					const videoUrls = {};
					shorts.forEach((s) => {
						videoUrls[s.shortcode] = s.videoUrl;
					});
					if (shortcodes.length === 0) {
						if (downloadButton) downloadButton.textContent = "Nenhum Short encontrado";
						setTimeout(() => {
							if (downloadButton) downloadButton.textContent = "Baixar Shorts";
						}, 2e3);
						isScanning = false;
						return;
					}
					const profile = extractProfileInfo();
					chrome.runtime.sendMessage({
						type: "DOWNLOAD_REELS",
						payload: {
							shortcodes,
							videoUrls,
							profileUrl: window.location.href,
							niches: [],
							profile,
							platform: "YOUTUBE"
						}
					});
				} catch (err) {
					console.error("[YouTube Content] Error:", err);
				} finally {
					isScanning = false;
					if (downloadButton) downloadButton.textContent = "Baixar Shorts";
				}
			}
			function checkPage() {
				if (isShortsPage() || isChannelPage()) createButton();
				else {
					downloadButton?.remove();
					downloadButton = null;
				}
			}
			checkPage();
			new MutationObserver(checkPage).observe(document.body, {
				childList: true,
				subtree: true
			});
		}
	});
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/internal/logger.mjs
	function print$1(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger$1 = {
		debug: (...args) => print$1(console.debug, ...args),
		log: (...args) => print$1(console.log, ...args),
		warn: (...args) => print$1(console.warn, ...args),
		error: (...args) => print$1(console.error, ...args)
	};
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/browser.mjs
	/**
	* Contains the `browser` export which you should use to access the extension
	* APIs in your project:
	*
	* ```ts
	* import { browser } from 'wxt/browser';
	*
	* browser.runtime.onInstalled.addListener(() => {
	*   // ...
	* });
	* ```
	*
	* @module wxt/browser
	*/
	var browser = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/internal/custom-events.mjs
	var WxtLocationChangeEvent = class WxtLocationChangeEvent extends Event {
		static EVENT_NAME = getUniqueEventName("wxt:locationchange");
		constructor(newUrl, oldUrl) {
			super(WxtLocationChangeEvent.EVENT_NAME, {});
			this.newUrl = newUrl;
			this.oldUrl = oldUrl;
		}
	};
	/**
	* Returns an event name unique to the extension and content script that's
	* running.
	*/
	function getUniqueEventName(eventName) {
		return `${browser?.runtime?.id}:youtube:${eventName}`;
	}
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/internal/location-watcher.mjs
	var supportsNavigationApi = typeof globalThis.navigation?.addEventListener === "function";
	/**
	* Create a util that watches for URL changes, dispatching the custom event when
	* detected. Stops watching when content script is invalidated. Uses Navigation
	* API when available, otherwise falls back to polling.
	*/
	function createLocationWatcher(ctx) {
		let lastUrl;
		let watching = false;
		return { run() {
			if (watching) return;
			watching = true;
			lastUrl = new URL(location.href);
			if (supportsNavigationApi) globalThis.navigation.addEventListener("navigate", (event) => {
				const newUrl = new URL(event.destination.url);
				if (newUrl.href === lastUrl.href) return;
				window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
				lastUrl = newUrl;
			}, { signal: ctx.signal });
			else ctx.setInterval(() => {
				const newUrl = new URL(location.href);
				if (newUrl.href !== lastUrl.href) {
					window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
					lastUrl = newUrl;
				}
			}, 1e3);
		} };
	}
	//#endregion
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/content-script-context.mjs
	/**
	* Implements
	* [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
	* Used to detect and stop content script code when the script is invalidated.
	*
	* It also provides several utilities like `ctx.setTimeout` and
	* `ctx.setInterval` that should be used in content scripts instead of
	* `window.setTimeout` or `window.setInterval`.
	*
	* To create context for testing, you can use the class's constructor:
	*
	* ```ts
	* import { ContentScriptContext } from 'wxt/utils/content-scripts-context';
	*
	* test('storage listener should be removed when context is invalidated', () => {
	*   const ctx = new ContentScriptContext('test');
	*   const item = storage.defineItem('local:count', { defaultValue: 0 });
	*   const watcher = vi.fn();
	*
	*   const unwatch = item.watch(watcher);
	*   ctx.onInvalidated(unwatch); // Listen for invalidate here
	*
	*   await item.setValue(1);
	*   expect(watcher).toBeCalledTimes(1);
	*   expect(watcher).toBeCalledWith(1, 0);
	*
	*   ctx.notifyInvalidated(); // Use this function to invalidate the context
	*   await item.setValue(2);
	*   expect(watcher).toBeCalledTimes(1);
	* });
	* ```
	*/
	var ContentScriptContext = class ContentScriptContext {
		static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName("wxt:content-script-started");
		id;
		abortController;
		locationWatcher = createLocationWatcher(this);
		constructor(contentScriptName, options) {
			this.contentScriptName = contentScriptName;
			this.options = options;
			this.id = Math.random().toString(36).slice(2);
			this.abortController = new AbortController();
			this.stopOldScripts();
			this.listenForNewerScripts();
		}
		get signal() {
			return this.abortController.signal;
		}
		abort(reason) {
			return this.abortController.abort(reason);
		}
		get isInvalid() {
			if (browser.runtime?.id == null) this.notifyInvalidated();
			return this.signal.aborted;
		}
		get isValid() {
			return !this.isInvalid;
		}
		/**
		* Add a listener that is called when the content script's context is
		* invalidated.
		*
		* @example
		*   browser.runtime.onMessage.addListener(cb);
		*   const removeInvalidatedListener = ctx.onInvalidated(() => {
		*     browser.runtime.onMessage.removeListener(cb);
		*   });
		*   // ...
		*   removeInvalidatedListener();
		*
		* @returns A function to remove the listener.
		*/
		onInvalidated(cb) {
			this.signal.addEventListener("abort", cb);
			return () => this.signal.removeEventListener("abort", cb);
		}
		/**
		* Return a promise that never resolves. Useful if you have an async function
		* that shouldn't run after the context is expired.
		*
		* @example
		*   const getValueFromStorage = async () => {
		*     if (ctx.isInvalid) return ctx.block();
		*
		*     // ...
		*   };
		*/
		block() {
			return new Promise(() => {});
		}
		/**
		* Wrapper around `window.setInterval` that automatically clears the interval
		* when invalidated.
		*
		* Intervals can be cleared by calling the normal `clearInterval` function.
		*/
		setInterval(handler, timeout) {
			const id = setInterval(() => {
				if (this.isValid) handler();
			}, timeout);
			this.onInvalidated(() => clearInterval(id));
			return id;
		}
		/**
		* Wrapper around `window.setTimeout` that automatically clears the interval
		* when invalidated.
		*
		* Timeouts can be cleared by calling the normal `setTimeout` function.
		*/
		setTimeout(handler, timeout) {
			const id = setTimeout(() => {
				if (this.isValid) handler();
			}, timeout);
			this.onInvalidated(() => clearTimeout(id));
			return id;
		}
		/**
		* Wrapper around `window.requestAnimationFrame` that automatically cancels
		* the request when invalidated.
		*
		* Callbacks can be canceled by calling the normal `cancelAnimationFrame`
		* function.
		*/
		requestAnimationFrame(callback) {
			const id = requestAnimationFrame((...args) => {
				if (this.isValid) callback(...args);
			});
			this.onInvalidated(() => cancelAnimationFrame(id));
			return id;
		}
		/**
		* Wrapper around `window.requestIdleCallback` that automatically cancels the
		* request when invalidated.
		*
		* Callbacks can be canceled by calling the normal `cancelIdleCallback`
		* function.
		*/
		requestIdleCallback(callback, options) {
			const id = requestIdleCallback((...args) => {
				if (!this.signal.aborted) callback(...args);
			}, options);
			this.onInvalidated(() => cancelIdleCallback(id));
			return id;
		}
		addEventListener(target, type, handler, options) {
			if (type === "wxt:locationchange") {
				if (this.isValid) this.locationWatcher.run();
			}
			target.addEventListener?.(type.startsWith("wxt:") ? getUniqueEventName(type) : type, handler, {
				...options,
				signal: this.signal
			});
		}
		/**
		* @internal
		* Abort the abort controller and execute all `onInvalidated` listeners.
		*/
		notifyInvalidated() {
			this.abort("Content script context invalidated");
			logger$1.debug(`Content script "${this.contentScriptName}" context invalidated`);
		}
		stopOldScripts() {
			document.dispatchEvent(new CustomEvent(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, { detail: {
				contentScriptName: this.contentScriptName,
				messageId: this.id
			} }));
			if (!this.options?.noScriptStartedPostMessage) window.postMessage({
				type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
				contentScriptName: this.contentScriptName,
				messageId: this.id
			}, "*");
		}
		verifyScriptStartedEvent(event) {
			const isSameContentScript = event.detail?.contentScriptName === this.contentScriptName;
			const isFromSelf = event.detail?.messageId === this.id;
			return isSameContentScript && !isFromSelf;
		}
		listenForNewerScripts() {
			const cb = (event) => {
				if (!(event instanceof CustomEvent) || !this.verifyScriptStartedEvent(event)) return;
				this.notifyInvalidated();
			};
			document.addEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb);
			this.onInvalidated(() => document.removeEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb));
		}
	};
	//#endregion
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?/home/gosantos/projects/postreels-v2/apps/extension/entrypoints/youtube.content.ts
	function print(method, ...args) {
		if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
		else method("[wxt]", ...args);
	}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
	};
	//#endregion
	return (async () => {
		try {
			const { main, ...options } = youtube_content_default;
			return await main(new ContentScriptContext("youtube", options));
		} catch (err) {
			logger.error(`The content script "youtube" crashed on startup!`, err);
			throw err;
		}
	})();
})();

youtube;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieW91dHViZS5qcyIsIm5hbWVzIjpbInByaW50IiwibG9nZ2VyIiwiYnJvd3NlciJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC4xOS40M19lc2xpbnRAOC41Ny4xX2ppdGlAMi43LjBfcm9sbGRvd25AMS4xLjUvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvbGliL3lvdXR1YmUudHMiLCIuLi8uLi8uLi9zcmMvbGliL3R5cGVzLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMveW91dHViZS5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLjE5LjQzX2VzbGludEA4LjU3LjFfaml0aUAyLjcuMF9yb2xsZG93bkAxLjEuNS9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC4xOS40M19lc2xpbnRAOC41Ny4xX2ppdGlAMi43LjBfcm9sbGRvd25AMS4xLjUvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLjE5LjQzX2VzbGludEA4LjU3LjFfaml0aUAyLjcuMF9yb2xsZG93bkAxLjEuNS9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCJleHBvcnQgaW50ZXJmYWNlIFJlZWxJbmZvIHtcbiAgc2hvcnRjb2RlOiBzdHJpbmdcbiAgdmlkZW9Vcmw6IHN0cmluZ1xuICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RTaG9ydHNGcm9tUGFnZSgpOiBSZWVsSW5mb1tdIHtcbiAgY29uc3Qgc2hvcnRzOiBSZWVsSW5mb1tdID0gW11cbiAgY29uc3QgbGlua3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PignYVtocmVmKj1cIi9zaG9ydHMvXCJdJylcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpXG5cbiAgbGlua3MuZm9yRWFjaChsaW5rID0+IHtcbiAgICBjb25zdCBtYXRjaCA9IGxpbmsuaHJlZi5tYXRjaCgvXFwvc2hvcnRzXFwvKFteLz8mXSspLylcbiAgICBpZiAoIW1hdGNoKSByZXR1cm5cbiAgICBjb25zdCBzaG9ydGNvZGUgPSBtYXRjaFsxXVxuICAgIGlmIChzZWVuLmhhcyhzaG9ydGNvZGUpKSByZXR1cm5cbiAgICBzZWVuLmFkZChzaG9ydGNvZGUpXG5cbiAgICBzaG9ydHMucHVzaCh7XG4gICAgICBzaG9ydGNvZGUsXG4gICAgICB2aWRlb1VybDogYGh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL3Nob3J0cy8ke3Nob3J0Y29kZX1gLFxuICAgICAgdGh1bWJuYWlsVXJsOiB1bmRlZmluZWQsXG4gICAgfSlcbiAgfSlcblxuICByZXR1cm4gc2hvcnRzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxTaG9ydHNMaW5rcygpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGxpbmtzID0gbmV3IFNldDxzdHJpbmc+KClcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQW5jaG9yRWxlbWVudD4oJ2FbaHJlZio9XCIvc2hvcnRzL1wiXScpLmZvckVhY2goYSA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBhLmhyZWYubWF0Y2goL1xcL3Nob3J0c1xcLyhbXi8/Jl0rKS8pXG4gICAgaWYgKG1hdGNoKSBsaW5rcy5hZGQobWF0Y2hbMV0pXG4gIH0pXG4gIHJldHVybiBbLi4ubGlua3NdXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0UHJvZmlsZUluZm8oKSB7XG4gIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZVxuICBjb25zdCB1c2VybmFtZSA9IHVybC5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKVswXT8ucmVwbGFjZSgnQCcsICcnKSB8fCAnJ1xuICBjb25zdCBuYW1lRWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxNZXRhRWxlbWVudD4oJ21ldGFbcHJvcGVydHk9XCJvZzp0aXRsZVwiXScpXG4gIGNvbnN0IGZ1bGxOYW1lID0gbmFtZUVsPy5jb250ZW50Py5yZXBsYWNlKCcgLSBZb3VUdWJlJywgJycpIHx8IHVzZXJuYW1lXG4gIGNvbnN0IGF2YXRhckVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MTWV0YUVsZW1lbnQ+KCdtZXRhW3Byb3BlcnR5PVwib2c6aW1hZ2VcIl0nKVxuICBjb25zdCBhdmF0YXJVcmwgPSBhdmF0YXJFbD8uY29udGVudCB8fCB1bmRlZmluZWRcbiAgcmV0dXJuIHsgdXNlcm5hbWUsIGZ1bGxOYW1lLCBhdmF0YXJVcmwgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTaG9ydHNQYWdlKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLmluY2x1ZGVzKCcvc2hvcnRzJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQ2hhbm5lbFBhZ2UoKTogYm9vbGVhbiB7XG4gIGNvbnN0IHBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pXG4gIHJldHVybiBwYXJ0cy5zb21lKHAgPT4gcC5zdGFydHNXaXRoKCdAJykpICYmICFwYXJ0cy5pbmNsdWRlcygnc2hvcnRzJylcbn1cbiIsImV4cG9ydCBpbnRlcmZhY2UgUG9zdFJlZWxzQ29uZmlnIHtcbiAgYXBpVXJsOiBzdHJpbmdcbiAgbWluaW9FbmRwb2ludDogc3RyaW5nXG4gIG1pbmlvQWNjZXNzS2V5OiBzdHJpbmdcbiAgbWluaW9TZWNyZXRLZXk6IHN0cmluZ1xuICBtaW5pb0J1Y2tldDogc3RyaW5nXG4gIGNvbmN1cnJlbmN5OiBudW1iZXJcbiAgc2Nyb2xsRGVsYXk6IG51bWJlclxuICBtYXhTY3JvbGxzOiBudW1iZXJcbiAgbWF4RG93bmxvYWRzOiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcm9maWxlSW5mbyB7XG4gIHVzZXJuYW1lOiBzdHJpbmdcbiAgZnVsbE5hbWU6IHN0cmluZ1xuICBhdmF0YXJVcmw/OiBzdHJpbmdcbiAgcG9zdHNDb3VudD86IG51bWJlclxuICBmb2xsb3dlcnNDb3VudD86IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBlbmRpbmdEb3dubG9hZCB7XG4gIHNob3J0Y29kZXM6IHN0cmluZ1tdXG4gIHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICBuaWNoZXM6IE5pY2hlW11cbiAgcHJvZmlsZVVybDogc3RyaW5nXG4gIHByb2ZpbGU/OiBQcm9maWxlSW5mb1xuICBwbGF0Zm9ybTogUGxhdGZvcm1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWVsSW5mbyB7XG4gIHNob3J0Y29kZTogc3RyaW5nXG4gIHZpZGVvVXJsOiBzdHJpbmdcbiAgdGh1bWJuYWlsVXJsPzogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIFBsYXRmb3JtID0gJ0lOU1RBR1JBTScgfCAnRkFDRUJPT0snIHwgJ1lPVVRVQkUnXG5cbmV4cG9ydCBpbnRlcmZhY2UgRG93bmxvYWRUYXNrIHtcbiAgaWQ6IHN0cmluZ1xuICBzaG9ydGNvZGU6IHN0cmluZ1xuICB2aWRlb1VybDogc3RyaW5nXG4gIG5pY2hlSWQ6IHN0cmluZ1xuICBwbGF0Zm9ybTogUGxhdGZvcm1cbiAgc3RhdHVzOiAncXVldWVkJyB8ICdkb3dubG9hZGluZycgfCAndXBsb2FkaW5nJyB8ICdjb21wbGV0ZWQnIHwgJ2Vycm9yJ1xuICBwcm9ncmVzczogbnVtYmVyXG4gIGVycm9yPzogc3RyaW5nXG4gIGZpbGVuYW1lPzogc3RyaW5nXG4gIGNyZWF0ZWRBdDogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmljaGUge1xuICBpZDogc3RyaW5nXG4gIG5vbWU6IHN0cmluZ1xuICBjb3I6IHN0cmluZyB8IG51bGxcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09ORklHOiBQb3N0UmVlbHNDb25maWcgPSB7XG4gIGFwaVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gIG1pbmlvRW5kcG9pbnQ6ICdodHRwOi8vbG9jYWxob3N0OjkwMDAnLFxuICBtaW5pb0FjY2Vzc0tleTogJ21pbmlvYWRtaW4nLFxuICBtaW5pb1NlY3JldEtleTogJ21pbmlvYWRtaW4nLFxuICBtaW5pb0J1Y2tldDogJ3Bvc3RyZWVscy1kb3dubG9hZHMnLFxuICBjb25jdXJyZW5jeTogMyxcbiAgc2Nyb2xsRGVsYXk6IDE1MDAsXG4gIG1heFNjcm9sbHM6IDUwLFxuICBtYXhEb3dubG9hZHM6IDIwLFxufVxuIiwiaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnXG5pbXBvcnQgeyBleHRyYWN0U2hvcnRzRnJvbVBhZ2UsIGV4dHJhY3RQcm9maWxlSW5mbywgaXNTaG9ydHNQYWdlLCBpc0NoYW5uZWxQYWdlIH0gZnJvbSAnLi4vc3JjL2xpYi95b3V0dWJlJ1xuaW1wb3J0IHsgREVGQVVMVF9DT05GSUcgfSBmcm9tICcuLi9zcmMvbGliL3R5cGVzJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL3d3dy55b3V0dWJlLmNvbS8qJ10sXG4gIG1haW4oKSB7XG4gICAgbGV0IGRvd25sb2FkQnV0dG9uOiBIVE1MRGl2RWxlbWVudCB8IG51bGwgPSBudWxsXG4gICAgbGV0IGlzU2Nhbm5pbmcgPSBmYWxzZVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlQnV0dG9uKCkge1xuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSByZXR1cm5cblxuICAgICAgZG93bmxvYWRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgICAgZG93bmxvYWRCdXR0b24uaWQgPSAncG9zdHJlZWxzLWRvd25sb2FkLWJ0bidcbiAgICAgIGRvd25sb2FkQnV0dG9uLnRleHRDb250ZW50ID0gJ0JhaXhhciBTaG9ydHMnXG4gICAgICBPYmplY3QuYXNzaWduKGRvd25sb2FkQnV0dG9uLnN0eWxlLCB7XG4gICAgICAgIHBvc2l0aW9uOiAnZml4ZWQnLFxuICAgICAgICBib3R0b206ICcyNHB4JyxcbiAgICAgICAgcmlnaHQ6ICcyNHB4JyxcbiAgICAgICAgekluZGV4OiAnOTk5OTk5JyxcbiAgICAgICAgcGFkZGluZzogJzEycHggMjBweCcsXG4gICAgICAgIGJhY2tncm91bmQ6ICdsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjZmY0ZTUwIDAlLCAjZjlkNDIzIDEwMCUpJyxcbiAgICAgICAgY29sb3I6ICcjZmZmJyxcbiAgICAgICAgYm9yZGVyOiAnbm9uZScsXG4gICAgICAgIGJvcmRlclJhZGl1czogJzEycHgnLFxuICAgICAgICBmb250U2l6ZTogJzE0cHgnLFxuICAgICAgICBmb250V2VpZ2h0OiAnNjAwJyxcbiAgICAgICAgY3Vyc29yOiAncG9pbnRlcicsXG4gICAgICAgIGJveFNoYWRvdzogJzAgOHB4IDMycHggcmdiYSgwLDAsMCwwLjMpJyxcbiAgICAgICAgdHJhbnNpdGlvbjogJ3RyYW5zZm9ybSAwLjJzLCBib3gtc2hhZG93IDAuMnMnLFxuICAgICAgICBmb250RmFtaWx5OiAnc3lzdGVtLXVpLCBzYW5zLXNlcmlmJyxcbiAgICAgIH0pXG4gICAgICBkb3dubG9hZEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWVudGVyJywgKCkgPT4ge1xuICAgICAgICBpZiAoZG93bmxvYWRCdXR0b24pIHtcbiAgICAgICAgICBkb3dubG9hZEJ1dHRvbi5zdHlsZS50cmFuc2Zvcm0gPSAnc2NhbGUoMS4wNSknXG4gICAgICAgICAgZG93bmxvYWRCdXR0b24uc3R5bGUuYm94U2hhZG93ID0gJzAgMTJweCA0MHB4IHJnYmEoMCwwLDAsMC40KSdcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIGRvd25sb2FkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbGVhdmUnLCAoKSA9PiB7XG4gICAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikge1xuICAgICAgICAgIGRvd25sb2FkQnV0dG9uLnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxKSdcbiAgICAgICAgICBkb3dubG9hZEJ1dHRvbi5zdHlsZS5ib3hTaGFkb3cgPSAnMCA4cHggMzJweCByZ2JhKDAsMCwwLDAuMyknXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGRvd25sb2FkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlRG93bmxvYWQpXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRvd25sb2FkQnV0dG9uKVxuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZURvd25sb2FkKCkge1xuICAgICAgaWYgKGlzU2Nhbm5pbmcpIHJldHVyblxuICAgICAgaXNTY2FubmluZyA9IHRydWVcbiAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikgZG93bmxvYWRCdXR0b24udGV4dENvbnRlbnQgPSAnRXNjYW5lYW5kby4uLidcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc3RvcmFnZSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0KERFRkFVTFRfQ09ORklHKVxuICAgICAgICBjb25zdCBjb25maWcgPSB7IC4uLkRFRkFVTFRfQ09ORklHLCAuLi5zdG9yYWdlIH1cbiAgICAgICAgY29uc3Qgc2hvcnRzID0gZXh0cmFjdFNob3J0c0Zyb21QYWdlKClcbiAgICAgICAgY29uc3Qgc2hvcnRjb2RlcyA9IHNob3J0cy5tYXAocyA9PiBzLnNob3J0Y29kZSlcbiAgICAgICAgY29uc3QgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICAgICAgc2hvcnRzLmZvckVhY2gocyA9PiB7IHZpZGVvVXJsc1tzLnNob3J0Y29kZV0gPSBzLnZpZGVvVXJsIH0pXG5cbiAgICAgICAgaWYgKHNob3J0Y29kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSBkb3dubG9hZEJ1dHRvbi50ZXh0Q29udGVudCA9ICdOZW5odW0gU2hvcnQgZW5jb250cmFkbydcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgaWYgKGRvd25sb2FkQnV0dG9uKSBkb3dubG9hZEJ1dHRvbi50ZXh0Q29udGVudCA9ICdCYWl4YXIgU2hvcnRzJyB9LCAyMDAwKVxuICAgICAgICAgIGlzU2Nhbm5pbmcgPSBmYWxzZVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJvZmlsZSA9IGV4dHJhY3RQcm9maWxlSW5mbygpXG5cbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgIHR5cGU6ICdET1dOTE9BRF9SRUVMUycsXG4gICAgICAgICAgcGF5bG9hZDoge1xuICAgICAgICAgICAgc2hvcnRjb2RlcyxcbiAgICAgICAgICAgIHZpZGVvVXJscyxcbiAgICAgICAgICAgIHByb2ZpbGVVcmw6IHdpbmRvdy5sb2NhdGlvbi5ocmVmLFxuICAgICAgICAgICAgbmljaGVzOiBbXSxcbiAgICAgICAgICAgIHByb2ZpbGUsXG4gICAgICAgICAgICBwbGF0Zm9ybTogJ1lPVVRVQkUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW1lvdVR1YmUgQ29udGVudF0gRXJyb3I6JywgZXJyKVxuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaXNTY2FubmluZyA9IGZhbHNlXG4gICAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikgZG93bmxvYWRCdXR0b24udGV4dENvbnRlbnQgPSAnQmFpeGFyIFNob3J0cydcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja1BhZ2UoKSB7XG4gICAgICBpZiAoaXNTaG9ydHNQYWdlKCkgfHwgaXNDaGFubmVsUGFnZSgpKSB7XG4gICAgICAgIGNyZWF0ZUJ1dHRvbigpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb3dubG9hZEJ1dHRvbj8ucmVtb3ZlKClcbiAgICAgICAgZG93bmxvYWRCdXR0b24gPSBudWxsXG4gICAgICB9XG4gICAgfVxuXG4gICAgY2hlY2tQYWdlKClcbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKGNoZWNrUGFnZSlcbiAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pXG4gIH0sXG59KVxuIiwiLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9sb2dnZXIudHNcbmZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuXHRpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG5cdGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikgbWV0aG9kKGBbd3h0XSAke2FyZ3Muc2hpZnQoKX1gLCAuLi5hcmdzKTtcblx0ZWxzZSBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbn1cbi8qKiBXcmFwcGVyIGFyb3VuZCBgY29uc29sZWAgd2l0aCBhIFwiW3d4dF1cIiBwcmVmaXggKi9cbmNvbnN0IGxvZ2dlciA9IHtcblx0ZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcblx0bG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuXHR3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcblx0ZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgbG9nZ2VyIH07XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIGJyb3dzZXIkMSB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL2Jyb3dzZXIudHNcbi8qKlxuKiBDb250YWlucyB0aGUgYGJyb3dzZXJgIGV4cG9ydCB3aGljaCB5b3Ugc2hvdWxkIHVzZSB0byBhY2Nlc3MgdGhlIGV4dGVuc2lvblxuKiBBUElzIGluIHlvdXIgcHJvamVjdDpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcbipcbiogYnJvd3Nlci5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiogICAvLyAuLi5cbiogfSk7XG4qIGBgYFxuKlxuKiBAbW9kdWxlIHd4dC9icm93c2VyXG4qL1xuY29uc3QgYnJvd3NlciA9IGJyb3dzZXIkMTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgYnJvd3NlciB9O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLnRzXG52YXIgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCA9IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG5cdHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xuXHRjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuXHRcdHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuXHRcdHRoaXMubmV3VXJsID0gbmV3VXJsO1xuXHRcdHRoaXMub2xkVXJsID0gb2xkVXJsO1xuXHR9XG59O1xuLyoqXG4qIFJldHVybnMgYW4gZXZlbnQgbmFtZSB1bmlxdWUgdG8gdGhlIGV4dGVuc2lvbiBhbmQgY29udGVudCBzY3JpcHQgdGhhdCdzXG4qIHJ1bm5pbmcuXG4qL1xuZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuXHRyZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQsIGdldFVuaXF1ZUV2ZW50TmFtZSB9O1xuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIudHNcbmNvbnN0IHN1cHBvcnRzTmF2aWdhdGlvbkFwaSA9IHR5cGVvZiBnbG9iYWxUaGlzLm5hdmlnYXRpb24/LmFkZEV2ZW50TGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIjtcbi8qKlxuKiBDcmVhdGUgYSB1dGlsIHRoYXQgd2F0Y2hlcyBmb3IgVVJMIGNoYW5nZXMsIGRpc3BhdGNoaW5nIHRoZSBjdXN0b20gZXZlbnQgd2hlblxuKiBkZXRlY3RlZC4gU3RvcHMgd2F0Y2hpbmcgd2hlbiBjb250ZW50IHNjcmlwdCBpcyBpbnZhbGlkYXRlZC4gVXNlcyBOYXZpZ2F0aW9uXG4qIEFQSSB3aGVuIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIGZhbGxzIGJhY2sgdG8gcG9sbGluZy5cbiovXG5mdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG5cdGxldCBsYXN0VXJsO1xuXHRsZXQgd2F0Y2hpbmcgPSBmYWxzZTtcblx0cmV0dXJuIHsgcnVuKCkge1xuXHRcdGlmICh3YXRjaGluZykgcmV0dXJuO1xuXHRcdHdhdGNoaW5nID0gdHJ1ZTtcblx0XHRsYXN0VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcblx0XHRpZiAoc3VwcG9ydHNOYXZpZ2F0aW9uQXBpKSBnbG9iYWxUaGlzLm5hdmlnYXRpb24uYWRkRXZlbnRMaXN0ZW5lcihcIm5hdmlnYXRlXCIsIChldmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3VXJsID0gbmV3IFVSTChldmVudC5kZXN0aW5hdGlvbi51cmwpO1xuXHRcdFx0aWYgKG5ld1VybC5ocmVmID09PSBsYXN0VXJsLmhyZWYpIHJldHVybjtcblx0XHRcdHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgbGFzdFVybCkpO1xuXHRcdFx0bGFzdFVybCA9IG5ld1VybDtcblx0XHR9LCB7IHNpZ25hbDogY3R4LnNpZ25hbCB9KTtcblx0XHRlbHNlIGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRjb25zdCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuXHRcdFx0aWYgKG5ld1VybC5ocmVmICE9PSBsYXN0VXJsLmhyZWYpIHtcblx0XHRcdFx0d2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBsYXN0VXJsKSk7XG5cdFx0XHRcdGxhc3RVcmwgPSBuZXdVcmw7XG5cdFx0XHR9XG5cdFx0fSwgMWUzKTtcblx0fSB9O1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfTtcbiIsImltcG9ydCB7IGxvZ2dlciB9IGZyb20gXCIuL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7IGdldFVuaXF1ZUV2ZW50TmFtZSB9IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0LnRzXG4vKipcbiogSW1wbGVtZW50c1xuKiBbYEFib3J0Q29udHJvbGxlcmBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9BYm9ydENvbnRyb2xsZXIpLlxuKiBVc2VkIHRvIGRldGVjdCBhbmQgc3RvcCBjb250ZW50IHNjcmlwdCBjb2RlIHdoZW4gdGhlIHNjcmlwdCBpcyBpbnZhbGlkYXRlZC5cbipcbiogSXQgYWxzbyBwcm92aWRlcyBzZXZlcmFsIHV0aWxpdGllcyBsaWtlIGBjdHguc2V0VGltZW91dGAgYW5kXG4qIGBjdHguc2V0SW50ZXJ2YWxgIHRoYXQgc2hvdWxkIGJlIHVzZWQgaW4gY29udGVudCBzY3JpcHRzIGluc3RlYWQgb2ZcbiogYHdpbmRvdy5zZXRUaW1lb3V0YCBvciBgd2luZG93LnNldEludGVydmFsYC5cbipcbiogVG8gY3JlYXRlIGNvbnRleHQgZm9yIHRlc3RpbmcsIHlvdSBjYW4gdXNlIHRoZSBjbGFzcydzIGNvbnN0cnVjdG9yOlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9IGZyb20gJ3d4dC91dGlscy9jb250ZW50LXNjcmlwdHMtY29udGV4dCc7XG4qXG4qIHRlc3QoJ3N0b3JhZ2UgbGlzdGVuZXIgc2hvdWxkIGJlIHJlbW92ZWQgd2hlbiBjb250ZXh0IGlzIGludmFsaWRhdGVkJywgKCkgPT4ge1xuKiAgIGNvbnN0IGN0eCA9IG5ldyBDb250ZW50U2NyaXB0Q29udGV4dCgndGVzdCcpO1xuKiAgIGNvbnN0IGl0ZW0gPSBzdG9yYWdlLmRlZmluZUl0ZW0oJ2xvY2FsOmNvdW50JywgeyBkZWZhdWx0VmFsdWU6IDAgfSk7XG4qICAgY29uc3Qgd2F0Y2hlciA9IHZpLmZuKCk7XG4qXG4qICAgY29uc3QgdW53YXRjaCA9IGl0ZW0ud2F0Y2god2F0Y2hlcik7XG4qICAgY3R4Lm9uSW52YWxpZGF0ZWQodW53YXRjaCk7IC8vIExpc3RlbiBmb3IgaW52YWxpZGF0ZSBoZXJlXG4qXG4qICAgYXdhaXQgaXRlbS5zZXRWYWx1ZSgxKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFRpbWVzKDEpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkV2l0aCgxLCAwKTtcbipcbiogICBjdHgubm90aWZ5SW52YWxpZGF0ZWQoKTsgLy8gVXNlIHRoaXMgZnVuY3Rpb24gdG8gaW52YWxpZGF0ZSB0aGUgY29udGV4dFxuKiAgIGF3YWl0IGl0ZW0uc2V0VmFsdWUoMik7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRUaW1lcygxKTtcbiogfSk7XG4qIGBgYFxuKi9cbnZhciBDb250ZW50U2NyaXB0Q29udGV4dCA9IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcblx0c3RhdGljIFNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpjb250ZW50LXNjcmlwdC1zdGFydGVkXCIpO1xuXHRpZDtcblx0YWJvcnRDb250cm9sbGVyO1xuXHRsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG5cdGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG5cdFx0dGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuXHRcdHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0dGhpcy5pZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpO1xuXHRcdHRoaXMuYWJvcnRDb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuXHRcdHRoaXMuc3RvcE9sZFNjcmlwdHMoKTtcblx0XHR0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuXHR9XG5cdGdldCBzaWduYWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcblx0fVxuXHRhYm9ydChyZWFzb24pIHtcblx0XHRyZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcblx0fVxuXHRnZXQgaXNJbnZhbGlkKCkge1xuXHRcdGlmIChicm93c2VyLnJ1bnRpbWU/LmlkID09IG51bGwpIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcblx0fVxuXHRnZXQgaXNWYWxpZCgpIHtcblx0XHRyZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuXHR9XG5cdC8qKlxuXHQqIEFkZCBhIGxpc3RlbmVyIHRoYXQgaXMgY2FsbGVkIHdoZW4gdGhlIGNvbnRlbnQgc2NyaXB0J3MgY29udGV4dCBpc1xuXHQqIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQGV4YW1wbGVcblx0KiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuXHQqICAgY29uc3QgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lciA9IGN0eC5vbkludmFsaWRhdGVkKCgpID0+IHtcblx0KiAgICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG5cdCogICB9KTtcblx0KiAgIC8vIC4uLlxuXHQqICAgcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuXHQqXG5cdCogQHJldHVybnMgQSBmdW5jdGlvbiB0byByZW1vdmUgdGhlIGxpc3RlbmVyLlxuXHQqL1xuXHRvbkludmFsaWRhdGVkKGNiKSB7XG5cdFx0dGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcblx0XHRyZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcblx0fVxuXHQvKipcblx0KiBSZXR1cm4gYSBwcm9taXNlIHRoYXQgbmV2ZXIgcmVzb2x2ZXMuIFVzZWZ1bCBpZiB5b3UgaGF2ZSBhbiBhc3luYyBmdW5jdGlvblxuXHQqIHRoYXQgc2hvdWxkbid0IHJ1biBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuXHQqXG5cdCogQGV4YW1wbGVcblx0KiAgIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG5cdCogICAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG5cdCpcblx0KiAgICAgLy8gLi4uXG5cdCogICB9O1xuXHQqL1xuXHRibG9jaygpIHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoKCkgPT4ge30pO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsXG5cdCogd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuXHQqL1xuXHRzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG5cdFx0Y29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRUaW1lb3V0YCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbFxuXHQqIHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBUaW1lb3V0cyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYHNldFRpbWVvdXRgIGZ1bmN0aW9uLlxuXHQqL1xuXHRzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcblx0XHRjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzXG5cdCogdGhlIHJlcXVlc3Qgd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWBcblx0KiBmdW5jdGlvbi5cblx0Ki9cblx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG5cdFx0Y29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuXHRcdH0pO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZVxuXHQqIHJlcXVlc3Qgd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgXG5cdCogZnVuY3Rpb24uXG5cdCovXG5cdHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcblx0XHRjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcblx0XHRcdGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG5cdFx0fSwgb3B0aW9ucyk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHRhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuXHRcdGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcblx0XHR9XG5cdFx0dGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/Lih0eXBlLnN0YXJ0c1dpdGgoXCJ3eHQ6XCIpID8gZ2V0VW5pcXVlRXZlbnROYW1lKHR5cGUpIDogdHlwZSwgaGFuZGxlciwge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdHNpZ25hbDogdGhpcy5zaWduYWxcblx0XHR9KTtcblx0fVxuXHQvKipcblx0KiBAaW50ZXJuYWxcblx0KiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cblx0Ki9cblx0bm90aWZ5SW52YWxpZGF0ZWQoKSB7XG5cdFx0dGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG5cdFx0bG9nZ2VyLmRlYnVnKGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYCk7XG5cdH1cblx0c3RvcE9sZFNjcmlwdHMoKSB7XG5cdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCB7IGRldGFpbDoge1xuXHRcdFx0Y29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG5cdFx0XHRtZXNzYWdlSWQ6IHRoaXMuaWRcblx0XHR9IH0pKTtcblx0XHRpZiAoIXRoaXMub3B0aW9ucz8ubm9TY3JpcHRTdGFydGVkUG9zdE1lc3NhZ2UpIHdpbmRvdy5wb3N0TWVzc2FnZSh7XG5cdFx0XHR0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG5cdFx0XHRjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcblx0XHRcdG1lc3NhZ2VJZDogdGhpcy5pZFxuXHRcdH0sIFwiKlwiKTtcblx0fVxuXHR2ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpIHtcblx0XHRjb25zdCBpc1NhbWVDb250ZW50U2NyaXB0ID0gZXZlbnQuZGV0YWlsPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcblx0XHRjb25zdCBpc0Zyb21TZWxmID0gZXZlbnQuZGV0YWlsPy5tZXNzYWdlSWQgPT09IHRoaXMuaWQ7XG5cdFx0cmV0dXJuIGlzU2FtZUNvbnRlbnRTY3JpcHQgJiYgIWlzRnJvbVNlbGY7XG5cdH1cblx0bGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCkge1xuXHRcdGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRpZiAoIShldmVudCBpbnN0YW5jZW9mIEN1c3RvbUV2ZW50KSB8fCAhdGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSByZXR1cm47XG5cdFx0XHR0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG5cdFx0fTtcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgY2IpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgY2IpKTtcblx0fVxufTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgQ29udGVudFNjcmlwdENvbnRleHQgfTtcbiJdLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCw0LDUsNiw3LDgsOV0sIm1hcHBpbmdzIjoi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