var facebook = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/define-content-script.mjs
	function defineContentScript(definition) {
		return definition;
	}
	//#endregion
	//#region src/lib/facebook.ts
	function extractReelsFromPage() {
		const reels = [];
		const links = document.querySelectorAll("a[href*=\"/reel/\"]");
		const seen = /* @__PURE__ */ new Set();
		links.forEach((link) => {
			const match = link.href.match(/\/reel\/([^/?]+)/);
			if (!match) return;
			const shortcode = match[1];
			if (seen.has(shortcode)) return;
			seen.add(shortcode);
			const video = link.querySelector("video");
			reels.push({
				shortcode,
				videoUrl: video?.src || video?.querySelector("source")?.src || "",
				thumbnailUrl: video?.poster || void 0
			});
		});
		return reels;
	}
	function extractProfileInfo() {
		const username = window.location.pathname.split("/").filter(Boolean)[0] || "";
		const fullName = document.querySelector("meta[property=\"og:title\"]")?.content || username;
		let avatarUrl;
		for (const sel of [
			"meta[property=\"og:image\"]",
			"meta[name=\"twitter:image\"]",
			"link[rel=\"image_src\"]"
		]) {
			const el = document.querySelector(sel);
			if (el) {
				const src = el.content || el.href;
				if (src && !src.includes("emoji")) {
					avatarUrl = src;
					break;
				}
			}
		}
		if (!avatarUrl) {
			const img = document.querySelector("img[data-visualcompletion=\"ignore-dynamic\"]");
			if (img?.src && !img.src.includes("data:")) avatarUrl = img.src;
		}
		return {
			username,
			fullName,
			avatarUrl
		};
	}
	function isReelsPage() {
		return window.location.pathname.includes("/reels/");
	}
	function isProfilePage() {
		const parts = window.location.pathname.split("/").filter(Boolean);
		return parts.length >= 1 && !parts.includes("reel") && !parts.includes("reels") && !parts.includes("stories");
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
	//#region entrypoints/facebook.content.ts
	var facebook_content_default = defineContentScript({
		matches: ["https://www.facebook.com/*"],
		main() {
			let downloadButton = null;
			let isScanning = false;
			function createButton() {
				if (downloadButton) return;
				downloadButton = document.createElement("div");
				downloadButton.id = "postreels-download-btn";
				downloadButton.textContent = "Baixar Reels";
				Object.assign(downloadButton.style, {
					position: "fixed",
					bottom: "24px",
					right: "24px",
					zIndex: "999999",
					padding: "12px 20px",
					background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
					const reels = extractReelsFromPage();
					const shortcodes = reels.map((r) => r.shortcode);
					const videoUrls = {};
					reels.forEach((r) => {
						videoUrls[r.shortcode] = r.videoUrl;
					});
					if (shortcodes.length === 0) {
						if (downloadButton) downloadButton.textContent = "Nenhum Reel encontrado";
						setTimeout(() => {
							if (downloadButton) downloadButton.textContent = "Baixar Reels";
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
							platform: "FACEBOOK"
						}
					});
				} catch (err) {
					console.error("[Facebook Content] Error:", err);
				} finally {
					isScanning = false;
					if (downloadButton) downloadButton.textContent = "Baixar Reels";
				}
			}
			function checkPage() {
				if (isReelsPage() || isProfilePage()) createButton();
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
		return `${browser?.runtime?.id}:facebook:${eventName}`;
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
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?/home/gosantos/projects/postreels-v2/apps/extension/entrypoints/facebook.content.ts
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
			const { main, ...options } = facebook_content_default;
			return await main(new ContentScriptContext("facebook", options));
		} catch (err) {
			logger.error(`The content script "facebook" crashed on startup!`, err);
			throw err;
		}
	})();
})();

facebook;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjZWJvb2suanMiLCJuYW1lcyI6WyJwcmludCIsImxvZ2dlciIsImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vc3JjL2xpYi9mYWNlYm9vay50cyIsIi4uLy4uLy4uL3NyYy9saWIvdHlwZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9mYWNlYm9vay5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLjE5LjQzX2VzbGludEA4LjU3LjFfaml0aUAyLjcuMF9yb2xsZG93bkAxLjEuNS9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC4xOS40M19lc2xpbnRAOC41Ny4xX2ppdGlAMi43LjBfcm9sbGRvd25AMS4xLjUvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLjE5LjQzX2VzbGludEA4LjU3LjFfaml0aUAyLjcuMF9yb2xsZG93bkAxLjEuNS9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCJleHBvcnQgaW50ZXJmYWNlIFJlZWxJbmZvIHtcbiAgc2hvcnRjb2RlOiBzdHJpbmdcbiAgdmlkZW9Vcmw6IHN0cmluZ1xuICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RSZWVsc0Zyb21QYWdlKCk6IFJlZWxJbmZvW10ge1xuICBjb25zdCByZWVsczogUmVlbEluZm9bXSA9IFtdXG4gIGNvbnN0IGxpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQW5jaG9yRWxlbWVudD4oJ2FbaHJlZio9XCIvcmVlbC9cIl0nKVxuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KClcblxuICBsaW5rcy5mb3JFYWNoKGxpbmsgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gbGluay5ocmVmLm1hdGNoKC9cXC9yZWVsXFwvKFteLz9dKykvKVxuICAgIGlmICghbWF0Y2gpIHJldHVyblxuICAgIGNvbnN0IHNob3J0Y29kZSA9IG1hdGNoWzFdXG4gICAgaWYgKHNlZW4uaGFzKHNob3J0Y29kZSkpIHJldHVyblxuICAgIHNlZW4uYWRkKHNob3J0Y29kZSlcblxuICAgIGNvbnN0IHZpZGVvID0gbGluay5xdWVyeVNlbGVjdG9yPEhUTUxWaWRlb0VsZW1lbnQ+KCd2aWRlbycpXG4gICAgcmVlbHMucHVzaCh7XG4gICAgICBzaG9ydGNvZGUsXG4gICAgICB2aWRlb1VybDogdmlkZW8/LnNyYyB8fCB2aWRlbz8ucXVlcnlTZWxlY3Rvcignc291cmNlJyk/LnNyYyB8fCAnJyxcbiAgICAgIHRodW1ibmFpbFVybDogdmlkZW8/LnBvc3RlciB8fCB1bmRlZmluZWQsXG4gICAgfSlcbiAgfSlcblxuICByZXR1cm4gcmVlbHNcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEFsbFJlZWxMaW5rcygpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGxpbmtzID0gbmV3IFNldDxzdHJpbmc+KClcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MQW5jaG9yRWxlbWVudD4oJ2FbaHJlZio9XCIvcmVlbC9cIl0nKS5mb3JFYWNoKGEgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0gYS5ocmVmLm1hdGNoKC9cXC9yZWVsXFwvKFteLz9dKykvKVxuICAgIGlmIChtYXRjaCkgbGlua3MuYWRkKG1hdGNoWzFdKVxuICB9KVxuICByZXR1cm4gWy4uLmxpbmtzXVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFByb2ZpbGVJbmZvKCkge1xuICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWVcbiAgY29uc3QgdXNlcm5hbWUgPSB1cmwuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbilbMF0gfHwgJydcbiAgY29uc3QgbmFtZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MTWV0YUVsZW1lbnQ+KCdtZXRhW3Byb3BlcnR5PVwib2c6dGl0bGVcIl0nKVxuICBjb25zdCBmdWxsTmFtZSA9IG5hbWVFbD8uY29udGVudCB8fCB1c2VybmFtZVxuXG4gIGxldCBhdmF0YXJVcmw6IHN0cmluZyB8IHVuZGVmaW5lZFxuXG4gIGNvbnN0IG1ldGFTZWxlY3RvcnMgPSBbXG4gICAgJ21ldGFbcHJvcGVydHk9XCJvZzppbWFnZVwiXScsXG4gICAgJ21ldGFbbmFtZT1cInR3aXR0ZXI6aW1hZ2VcIl0nLFxuICAgICdsaW5rW3JlbD1cImltYWdlX3NyY1wiXScsXG4gIF1cbiAgZm9yIChjb25zdCBzZWwgb2YgbWV0YVNlbGVjdG9ycykge1xuICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MTWV0YUVsZW1lbnQgfCBIVE1MTGlua0VsZW1lbnQ+KHNlbClcbiAgICBpZiAoZWwpIHtcbiAgICAgIGNvbnN0IHNyYyA9IChlbCBhcyBIVE1MTWV0YUVsZW1lbnQpLmNvbnRlbnQgfHwgKGVsIGFzIEhUTUxMaW5rRWxlbWVudCkuaHJlZlxuICAgICAgaWYgKHNyYyAmJiAhc3JjLmluY2x1ZGVzKCdlbW9qaScpKSB7IGF2YXRhclVybCA9IHNyYzsgYnJlYWsgfVxuICAgIH1cbiAgfVxuXG4gIGlmICghYXZhdGFyVXJsKSB7XG4gICAgY29uc3QgaW1nID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MSW1hZ2VFbGVtZW50PignaW1nW2RhdGEtdmlzdWFsY29tcGxldGlvbj1cImlnbm9yZS1keW5hbWljXCJdJylcbiAgICBpZiAoaW1nPy5zcmMgJiYgIWltZy5zcmMuaW5jbHVkZXMoJ2RhdGE6JykpIGF2YXRhclVybCA9IGltZy5zcmNcbiAgfVxuXG4gIHJldHVybiB7IHVzZXJuYW1lLCBmdWxsTmFtZSwgYXZhdGFyVXJsIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUmVlbHNQYWdlKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLmluY2x1ZGVzKCcvcmVlbHMvJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvZmlsZVBhZ2UoKTogYm9vbGVhbiB7XG4gIGNvbnN0IHBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pXG4gIHJldHVybiBwYXJ0cy5sZW5ndGggPj0gMSAmJiAhcGFydHMuaW5jbHVkZXMoJ3JlZWwnKSAmJiAhcGFydHMuaW5jbHVkZXMoJ3JlZWxzJykgJiYgIXBhcnRzLmluY2x1ZGVzKCdzdG9yaWVzJylcbn1cbiIsImV4cG9ydCBpbnRlcmZhY2UgUG9zdFJlZWxzQ29uZmlnIHtcbiAgYXBpVXJsOiBzdHJpbmdcbiAgbWluaW9FbmRwb2ludDogc3RyaW5nXG4gIG1pbmlvQWNjZXNzS2V5OiBzdHJpbmdcbiAgbWluaW9TZWNyZXRLZXk6IHN0cmluZ1xuICBtaW5pb0J1Y2tldDogc3RyaW5nXG4gIGNvbmN1cnJlbmN5OiBudW1iZXJcbiAgc2Nyb2xsRGVsYXk6IG51bWJlclxuICBtYXhTY3JvbGxzOiBudW1iZXJcbiAgbWF4RG93bmxvYWRzOiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcm9maWxlSW5mbyB7XG4gIHVzZXJuYW1lOiBzdHJpbmdcbiAgZnVsbE5hbWU6IHN0cmluZ1xuICBhdmF0YXJVcmw/OiBzdHJpbmdcbiAgcG9zdHNDb3VudD86IG51bWJlclxuICBmb2xsb3dlcnNDb3VudD86IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBlbmRpbmdEb3dubG9hZCB7XG4gIHNob3J0Y29kZXM6IHN0cmluZ1tdXG4gIHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICBuaWNoZXM6IE5pY2hlW11cbiAgcHJvZmlsZVVybDogc3RyaW5nXG4gIHByb2ZpbGU/OiBQcm9maWxlSW5mb1xuICBwbGF0Zm9ybTogUGxhdGZvcm1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWVsSW5mbyB7XG4gIHNob3J0Y29kZTogc3RyaW5nXG4gIHZpZGVvVXJsOiBzdHJpbmdcbiAgdGh1bWJuYWlsVXJsPzogc3RyaW5nXG59XG5cbmV4cG9ydCB0eXBlIFBsYXRmb3JtID0gJ0lOU1RBR1JBTScgfCAnRkFDRUJPT0snIHwgJ1lPVVRVQkUnXG5cbmV4cG9ydCBpbnRlcmZhY2UgRG93bmxvYWRUYXNrIHtcbiAgaWQ6IHN0cmluZ1xuICBzaG9ydGNvZGU6IHN0cmluZ1xuICB2aWRlb1VybDogc3RyaW5nXG4gIG5pY2hlSWQ6IHN0cmluZ1xuICBwbGF0Zm9ybTogUGxhdGZvcm1cbiAgc3RhdHVzOiAncXVldWVkJyB8ICdkb3dubG9hZGluZycgfCAndXBsb2FkaW5nJyB8ICdjb21wbGV0ZWQnIHwgJ2Vycm9yJ1xuICBwcm9ncmVzczogbnVtYmVyXG4gIGVycm9yPzogc3RyaW5nXG4gIGZpbGVuYW1lPzogc3RyaW5nXG4gIGNyZWF0ZWRBdDogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmljaGUge1xuICBpZDogc3RyaW5nXG4gIG5vbWU6IHN0cmluZ1xuICBjb3I6IHN0cmluZyB8IG51bGxcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQ09ORklHOiBQb3N0UmVlbHNDb25maWcgPSB7XG4gIGFwaVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gIG1pbmlvRW5kcG9pbnQ6ICdodHRwOi8vbG9jYWxob3N0OjkwMDAnLFxuICBtaW5pb0FjY2Vzc0tleTogJ21pbmlvYWRtaW4nLFxuICBtaW5pb1NlY3JldEtleTogJ21pbmlvYWRtaW4nLFxuICBtaW5pb0J1Y2tldDogJ3Bvc3RyZWVscy1kb3dubG9hZHMnLFxuICBjb25jdXJyZW5jeTogMyxcbiAgc2Nyb2xsRGVsYXk6IDE1MDAsXG4gIG1heFNjcm9sbHM6IDUwLFxuICBtYXhEb3dubG9hZHM6IDIwLFxufVxuIiwiaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnXG5pbXBvcnQgeyBleHRyYWN0UmVlbHNGcm9tUGFnZSwgZXh0cmFjdFByb2ZpbGVJbmZvLCBpc1JlZWxzUGFnZSwgaXNQcm9maWxlUGFnZSB9IGZyb20gJy4uL3NyYy9saWIvZmFjZWJvb2snXG5pbXBvcnQgeyBERUZBVUxUX0NPTkZJRyB9IGZyb20gJy4uL3NyYy9saWIvdHlwZXMnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbnRlbnRTY3JpcHQoe1xuICBtYXRjaGVzOiBbJ2h0dHBzOi8vd3d3LmZhY2Vib29rLmNvbS8qJ10sXG4gIG1haW4oKSB7XG4gICAgbGV0IGRvd25sb2FkQnV0dG9uOiBIVE1MRGl2RWxlbWVudCB8IG51bGwgPSBudWxsXG4gICAgbGV0IGlzU2Nhbm5pbmcgPSBmYWxzZVxuXG4gICAgZnVuY3Rpb24gY3JlYXRlQnV0dG9uKCkge1xuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSByZXR1cm5cblxuICAgICAgZG93bmxvYWRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgICAgZG93bmxvYWRCdXR0b24uaWQgPSAncG9zdHJlZWxzLWRvd25sb2FkLWJ0bidcbiAgICAgIGRvd25sb2FkQnV0dG9uLnRleHRDb250ZW50ID0gJ0JhaXhhciBSZWVscydcbiAgICAgIE9iamVjdC5hc3NpZ24oZG93bmxvYWRCdXR0b24uc3R5bGUsIHtcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXG4gICAgICAgIGJvdHRvbTogJzI0cHgnLFxuICAgICAgICByaWdodDogJzI0cHgnLFxuICAgICAgICB6SW5kZXg6ICc5OTk5OTknLFxuICAgICAgICBwYWRkaW5nOiAnMTJweCAyMHB4JyxcbiAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCgxMzVkZWcsICM2NjdlZWEgMCUsICM3NjRiYTIgMTAwJSknLFxuICAgICAgICBjb2xvcjogJyNmZmYnLFxuICAgICAgICBib3JkZXI6ICdub25lJyxcbiAgICAgICAgYm9yZGVyUmFkaXVzOiAnMTJweCcsXG4gICAgICAgIGZvbnRTaXplOiAnMTRweCcsXG4gICAgICAgIGZvbnRXZWlnaHQ6ICc2MDAnLFxuICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgYm94U2hhZG93OiAnMCA4cHggMzJweCByZ2JhKDAsMCwwLDAuMyknLFxuICAgICAgICB0cmFuc2l0aW9uOiAndHJhbnNmb3JtIDAuMnMsIGJveC1zaGFkb3cgMC4ycycsXG4gICAgICAgIGZvbnRGYW1pbHk6ICdzeXN0ZW0tdWksIHNhbnMtc2VyaWYnLFxuICAgICAgfSlcbiAgICAgIGRvd25sb2FkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZW50ZXInLCAoKSA9PiB7XG4gICAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikge1xuICAgICAgICAgIGRvd25sb2FkQnV0dG9uLnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxLjA1KSdcbiAgICAgICAgICBkb3dubG9hZEJ1dHRvbi5zdHlsZS5ib3hTaGFkb3cgPSAnMCAxMnB4IDQwcHggcmdiYSgwLDAsMCwwLjQpJ1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgZG93bmxvYWRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VsZWF2ZScsICgpID0+IHtcbiAgICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSB7XG4gICAgICAgICAgZG93bmxvYWRCdXR0b24uc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEpJ1xuICAgICAgICAgIGRvd25sb2FkQnV0dG9uLnN0eWxlLmJveFNoYWRvdyA9ICcwIDhweCAzMnB4IHJnYmEoMCwwLDAsMC4zKSdcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgZG93bmxvYWRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVEb3dubG9hZClcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG93bmxvYWRCdXR0b24pXG4gICAgfVxuXG4gICAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRG93bmxvYWQoKSB7XG4gICAgICBpZiAoaXNTY2FubmluZykgcmV0dXJuXG4gICAgICBpc1NjYW5uaW5nID0gdHJ1ZVxuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSBkb3dubG9hZEJ1dHRvbi50ZXh0Q29udGVudCA9ICdFc2NhbmVhbmRvLi4uJ1xuXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBzdG9yYWdlID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoREVGQVVMVF9DT05GSUcpXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHsgLi4uREVGQVVMVF9DT05GSUcsIC4uLnN0b3JhZ2UgfVxuICAgICAgICBjb25zdCByZWVscyA9IGV4dHJhY3RSZWVsc0Zyb21QYWdlKClcbiAgICAgICAgY29uc3Qgc2hvcnRjb2RlcyA9IHJlZWxzLm1hcChyID0+IHIuc2hvcnRjb2RlKVxuICAgICAgICBjb25zdCB2aWRlb1VybHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuICAgICAgICByZWVscy5mb3JFYWNoKHIgPT4geyB2aWRlb1VybHNbci5zaG9ydGNvZGVdID0gci52aWRlb1VybCB9KVxuXG4gICAgICAgIGlmIChzaG9ydGNvZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikgZG93bmxvYWRCdXR0b24udGV4dENvbnRlbnQgPSAnTmVuaHVtIFJlZWwgZW5jb250cmFkbydcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgaWYgKGRvd25sb2FkQnV0dG9uKSBkb3dubG9hZEJ1dHRvbi50ZXh0Q29udGVudCA9ICdCYWl4YXIgUmVlbHMnIH0sIDIwMDApXG4gICAgICAgICAgaXNTY2FubmluZyA9IGZhbHNlXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9maWxlID0gZXh0cmFjdFByb2ZpbGVJbmZvKClcblxuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgdHlwZTogJ0RPV05MT0FEX1JFRUxTJyxcbiAgICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgICBzaG9ydGNvZGVzLFxuICAgICAgICAgICAgdmlkZW9VcmxzLFxuICAgICAgICAgICAgcHJvZmlsZVVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICAgICAgICBuaWNoZXM6IFtdLFxuICAgICAgICAgICAgcHJvZmlsZSxcbiAgICAgICAgICAgIHBsYXRmb3JtOiAnRkFDRUJPT0snLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pXG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW0ZhY2Vib29rIENvbnRlbnRdIEVycm9yOicsIGVycilcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlzU2Nhbm5pbmcgPSBmYWxzZVxuICAgICAgICBpZiAoZG93bmxvYWRCdXR0b24pIGRvd25sb2FkQnV0dG9uLnRleHRDb250ZW50ID0gJ0JhaXhhciBSZWVscydcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjaGVja1BhZ2UoKSB7XG4gICAgICBpZiAoaXNSZWVsc1BhZ2UoKSB8fCBpc1Byb2ZpbGVQYWdlKCkpIHtcbiAgICAgICAgY3JlYXRlQnV0dG9uKClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRvd25sb2FkQnV0dG9uPy5yZW1vdmUoKVxuICAgICAgICBkb3dubG9hZEJ1dHRvbiA9IG51bGxcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjaGVja1BhZ2UoKVxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2hlY2tQYWdlKVxuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSlcbiAgfSxcbn0pXG4iLCIvLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2xvZ2dlci50c1xuZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG5cdGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcblx0aWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSBtZXRob2QoYFt3eHRdICR7YXJncy5zaGlmdCgpfWAsIC4uLmFyZ3MpO1xuXHRlbHNlIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xufVxuLyoqIFdyYXBwZXIgYXJvdW5kIGBjb25zb2xlYCB3aXRoIGEgXCJbd3h0XVwiIHByZWZpeCAqL1xuY29uc3QgbG9nZ2VyID0ge1xuXHRkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuXHRsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG5cdHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuXHRlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBsb2dnZXIgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMudHNcbnZhciBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50ID0gY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcblx0c3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG5cdGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG5cdFx0c3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG5cdFx0dGhpcy5uZXdVcmwgPSBuZXdVcmw7XG5cdFx0dGhpcy5vbGRVcmwgPSBvbGRVcmw7XG5cdH1cbn07XG4vKipcbiogUmV0dXJucyBhbiBldmVudCBuYW1lIHVuaXF1ZSB0byB0aGUgZXh0ZW5zaW9uIGFuZCBjb250ZW50IHNjcmlwdCB0aGF0J3NcbiogcnVubmluZy5cbiovXG5mdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG5cdHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCwgZ2V0VW5pcXVlRXZlbnROYW1lIH07XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci50c1xuY29uc3Qgc3VwcG9ydHNOYXZpZ2F0aW9uQXBpID0gdHlwZW9mIGdsb2JhbFRoaXMubmF2aWdhdGlvbj8uYWRkRXZlbnRMaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiO1xuLyoqXG4qIENyZWF0ZSBhIHV0aWwgdGhhdCB3YXRjaGVzIGZvciBVUkwgY2hhbmdlcywgZGlzcGF0Y2hpbmcgdGhlIGN1c3RvbSBldmVudCB3aGVuXG4qIGRldGVjdGVkLiBTdG9wcyB3YXRjaGluZyB3aGVuIGNvbnRlbnQgc2NyaXB0IGlzIGludmFsaWRhdGVkLiBVc2VzIE5hdmlnYXRpb25cbiogQVBJIHdoZW4gYXZhaWxhYmxlLCBvdGhlcndpc2UgZmFsbHMgYmFjayB0byBwb2xsaW5nLlxuKi9cbmZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcblx0bGV0IGxhc3RVcmw7XG5cdGxldCB3YXRjaGluZyA9IGZhbHNlO1xuXHRyZXR1cm4geyBydW4oKSB7XG5cdFx0aWYgKHdhdGNoaW5nKSByZXR1cm47XG5cdFx0d2F0Y2hpbmcgPSB0cnVlO1xuXHRcdGxhc3RVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuXHRcdGlmIChzdXBwb3J0c05hdmlnYXRpb25BcGkpIGdsb2JhbFRoaXMubmF2aWdhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwibmF2aWdhdGVcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXdVcmwgPSBuZXcgVVJMKGV2ZW50LmRlc3RpbmF0aW9uLnVybCk7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgPT09IGxhc3RVcmwuaHJlZikgcmV0dXJuO1xuXHRcdFx0d2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBsYXN0VXJsKSk7XG5cdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdH0sIHsgc2lnbmFsOiBjdHguc2lnbmFsIH0pO1xuXHRcdGVsc2UgY3R4LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgIT09IGxhc3RVcmwuaHJlZikge1xuXHRcdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdFx0bGFzdFVybCA9IG5ld1VybDtcblx0XHRcdH1cblx0XHR9LCAxZTMpO1xuXHR9IH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9O1xuIiwiaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgZ2V0VW5pcXVlRXZlbnROYW1lIH0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQudHNcbi8qKlxuKiBJbXBsZW1lbnRzXG4qIFtgQWJvcnRDb250cm9sbGVyYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0Fib3J0Q29udHJvbGxlcikuXG4qIFVzZWQgdG8gZGV0ZWN0IGFuZCBzdG9wIGNvbnRlbnQgc2NyaXB0IGNvZGUgd2hlbiB0aGUgc2NyaXB0IGlzIGludmFsaWRhdGVkLlxuKlxuKiBJdCBhbHNvIHByb3ZpZGVzIHNldmVyYWwgdXRpbGl0aWVzIGxpa2UgYGN0eC5zZXRUaW1lb3V0YCBhbmRcbiogYGN0eC5zZXRJbnRlcnZhbGAgdGhhdCBzaG91bGQgYmUgdXNlZCBpbiBjb250ZW50IHNjcmlwdHMgaW5zdGVhZCBvZlxuKiBgd2luZG93LnNldFRpbWVvdXRgIG9yIGB3aW5kb3cuc2V0SW50ZXJ2YWxgLlxuKlxuKiBUbyBjcmVhdGUgY29udGV4dCBmb3IgdGVzdGluZywgeW91IGNhbiB1c2UgdGhlIGNsYXNzJ3MgY29uc3RydWN0b3I6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0cy1jb250ZXh0JztcbipcbiogdGVzdCgnc3RvcmFnZSBsaXN0ZW5lciBzaG91bGQgYmUgcmVtb3ZlZCB3aGVuIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQnLCAoKSA9PiB7XG4qICAgY29uc3QgY3R4ID0gbmV3IENvbnRlbnRTY3JpcHRDb250ZXh0KCd0ZXN0Jyk7XG4qICAgY29uc3QgaXRlbSA9IHN0b3JhZ2UuZGVmaW5lSXRlbSgnbG9jYWw6Y291bnQnLCB7IGRlZmF1bHRWYWx1ZTogMCB9KTtcbiogICBjb25zdCB3YXRjaGVyID0gdmkuZm4oKTtcbipcbiogICBjb25zdCB1bndhdGNoID0gaXRlbS53YXRjaCh3YXRjaGVyKTtcbiogICBjdHgub25JbnZhbGlkYXRlZCh1bndhdGNoKTsgLy8gTGlzdGVuIGZvciBpbnZhbGlkYXRlIGhlcmVcbipcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDEpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRXaXRoKDEsIDApO1xuKlxuKiAgIGN0eC5ub3RpZnlJbnZhbGlkYXRlZCgpOyAvLyBVc2UgdGhpcyBmdW5jdGlvbiB0byBpbnZhbGlkYXRlIHRoZSBjb250ZXh0XG4qICAgYXdhaXQgaXRlbS5zZXRWYWx1ZSgyKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFRpbWVzKDEpO1xuKiB9KTtcbiogYGBgXG4qL1xudmFyIENvbnRlbnRTY3JpcHRDb250ZXh0ID0gY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuXHRzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIik7XG5cdGlkO1xuXHRhYm9ydENvbnRyb2xsZXI7XG5cdGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcblx0Y29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcblx0XHR0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLmlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMik7XG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0dGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuXHRcdHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG5cdH1cblx0Z2V0IHNpZ25hbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuXHR9XG5cdGFib3J0KHJlYXNvbikge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuXHR9XG5cdGdldCBpc0ludmFsaWQoKSB7XG5cdFx0aWYgKGJyb3dzZXIucnVudGltZT8uaWQgPT0gbnVsbCkgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuXHR9XG5cdGdldCBpc1ZhbGlkKCkge1xuXHRcdHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG5cdH1cblx0LyoqXG5cdCogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzXG5cdCogaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG5cdCogICBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuXHQqICAgICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcblx0KiAgIH0pO1xuXHQqICAgLy8gLi4uXG5cdCogICByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG5cdCpcblx0KiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG5cdCovXG5cdG9uSW52YWxpZGF0ZWQoY2IpIHtcblx0XHR0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHRcdHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHR9XG5cdC8qKlxuXHQqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uXG5cdCogdGhhdCBzaG91bGRuJ3QgcnVuIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcblx0KiAgICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcblx0KlxuXHQqICAgICAvLyAuLi5cblx0KiAgIH07XG5cdCovXG5cdGJsb2NrKCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7fSk7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcblx0XHRjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsXG5cdCogd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHNcblx0KiB0aGUgcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcblx0XHRjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG5cdFx0fSk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlXG5cdCogcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2Bcblx0KiBmdW5jdGlvbi5cblx0Ki9cblx0cmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9LCBvcHRpb25zKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG5cdFx0aWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuXHRcdH1cblx0XHR0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLCBoYW5kbGVyLCB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0c2lnbmFsOiB0aGlzLnNpZ25hbFxuXHRcdH0pO1xuXHR9XG5cdC8qKlxuXHQqIEBpbnRlcm5hbFxuXHQqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuXHQqL1xuXHRub3RpZnlJbnZhbGlkYXRlZCgpIHtcblx0XHR0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcblx0XHRsb2dnZXIuZGVidWcoYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgKTtcblx0fVxuXHRzdG9wT2xkU2NyaXB0cygpIHtcblx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIHsgZGV0YWlsOiB7XG5cdFx0XHRjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcblx0XHRcdG1lc3NhZ2VJZDogdGhpcy5pZFxuXHRcdH0gfSkpO1xuXHRcdGlmICghdGhpcy5vcHRpb25zPy5ub1NjcmlwdFN0YXJ0ZWRQb3N0TWVzc2FnZSkgd2luZG93LnBvc3RNZXNzYWdlKHtcblx0XHRcdHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSwgXCIqXCIpO1xuXHR9XG5cdHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuXHRcdGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kZXRhaWw/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuXHRcdGNvbnN0IGlzRnJvbVNlbGYgPSBldmVudC5kZXRhaWw/Lm1lc3NhZ2VJZCA9PT0gdGhpcy5pZDtcblx0XHRyZXR1cm4gaXNTYW1lQ29udGVudFNjcmlwdCAmJiAhaXNGcm9tU2VsZjtcblx0fVxuXHRsaXN0ZW5Gb3JOZXdlclNjcmlwdHMoKSB7XG5cdFx0Y29uc3QgY2IgPSAoZXZlbnQpID0+IHtcblx0XHRcdGlmICghKGV2ZW50IGluc3RhbmNlb2YgQ3VzdG9tRXZlbnQpIHx8ICF0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHJldHVybjtcblx0XHRcdHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcblx0XHR9O1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYik7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYikpO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9O1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDQsNSw2LDcsOCw5XSwibWFwcGluZ3MiOiI7O0NBQ0EsU0FBUyxvQkFBb0IsWUFBWTtFQUN4QyxPQUFPO0NBQ1I7OztDQ0dBLFNBQWdCLHVCQUFtQztFQUNqRCxNQUFNLFFBQW9CLENBQUM7RUFDM0IsTUFBTSxRQUFRLFNBQVMsaUJBQW9DLHFCQUFtQjtFQUM5RSxNQUFNLHVCQUFPLElBQUksSUFBWTtFQUU3QixNQUFNLFNBQVEsU0FBUTtHQUNwQixNQUFNLFFBQVEsS0FBSyxLQUFLLE1BQU0sa0JBQWtCO0dBQ2hELElBQUksQ0FBQyxPQUFPO0dBQ1osTUFBTSxZQUFZLE1BQU07R0FDeEIsSUFBSSxLQUFLLElBQUksU0FBUyxHQUFHO0dBQ3pCLEtBQUssSUFBSSxTQUFTO0dBRWxCLE1BQU0sUUFBUSxLQUFLLGNBQWdDLE9BQU87R0FDMUQsTUFBTSxLQUFLO0lBQ1Q7SUFDQSxVQUFVLE9BQU8sT0FBTyxPQUFPLGNBQWMsUUFBUSxDQUFDLEVBQUUsT0FBTztJQUMvRCxjQUFjLE9BQU8sVUFBVSxLQUFBO0dBQ2pDLENBQUM7RUFDSCxDQUFDO0VBRUQsT0FBTztDQUNUO0NBV0EsU0FBZ0IscUJBQXFCO0VBRW5DLE1BQU0sV0FETSxPQUFPLFNBQVMsU0FDUCxNQUFNLEdBQUcsQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLENBQUMsTUFBTTtFQUV0RCxNQUFNLFdBRFMsU0FBUyxjQUErQiw2QkFDdEMsQ0FBQSxFQUFRLFdBQVc7RUFFcEMsSUFBSTtFQU9KLEtBQUssTUFBTSxPQUFPO0dBSmhCO0dBQ0E7R0FDQTtFQUVnQixHQUFlO0dBQy9CLE1BQU0sS0FBSyxTQUFTLGNBQWlELEdBQUc7R0FDeEUsSUFBSSxJQUFJO0lBQ04sTUFBTSxNQUFPLEdBQXVCLFdBQVksR0FBdUI7SUFDdkUsSUFBSSxPQUFPLENBQUMsSUFBSSxTQUFTLE9BQU8sR0FBRztLQUFFLFlBQVk7S0FBSztJQUFNO0dBQzlEO0VBQ0Y7RUFFQSxJQUFJLENBQUMsV0FBVztHQUNkLE1BQU0sTUFBTSxTQUFTLGNBQWdDLCtDQUE2QztHQUNsRyxJQUFJLEtBQUssT0FBTyxDQUFDLElBQUksSUFBSSxTQUFTLE9BQU8sR0FBRyxZQUFZLElBQUk7RUFDOUQ7RUFFQSxPQUFPO0dBQUU7R0FBVTtHQUFVO0VBQVU7Q0FDekM7Q0FFQSxTQUFnQixjQUF1QjtFQUNyQyxPQUFPLE9BQU8sU0FBUyxTQUFTLFNBQVMsU0FBUztDQUNwRDtDQUVBLFNBQWdCLGdCQUF5QjtFQUN2QyxNQUFNLFFBQVEsT0FBTyxTQUFTLFNBQVMsTUFBTSxHQUFHLENBQUMsQ0FBQyxPQUFPLE9BQU87RUFDaEUsT0FBTyxNQUFNLFVBQVUsS0FBSyxDQUFDLE1BQU0sU0FBUyxNQUFNLEtBQUssQ0FBQyxNQUFNLFNBQVMsT0FBTyxLQUFLLENBQUMsTUFBTSxTQUFTLFNBQVM7Q0FDOUc7OztDQ2xCQSxJQUFhLGlCQUFrQztFQUM3QyxRQUFRO0VBQ1IsZUFBZTtFQUNmLGdCQUFnQjtFQUNoQixnQkFBZ0I7RUFDaEIsYUFBYTtFQUNiLGFBQWE7RUFDYixhQUFhO0VBQ2IsWUFBWTtFQUNaLGNBQWM7Q0FDaEI7OztDQzlEQSxJQUFBLDJCQUFlLG9CQUFvQjtFQUNqQyxTQUFTLENBQUMsNEJBQTRCO0VBQ3RDLE9BQU87R0FDTCxJQUFJLGlCQUF3QztHQUM1QyxJQUFJLGFBQWE7R0FFakIsU0FBUyxlQUFlO0lBQ3RCLElBQUksZ0JBQWdCO0lBRXBCLGlCQUFpQixTQUFTLGNBQWMsS0FBSztJQUM3QyxlQUFlLEtBQUs7SUFDcEIsZUFBZSxjQUFjO0lBQzdCLE9BQU8sT0FBTyxlQUFlLE9BQU87S0FDbEMsVUFBVTtLQUNWLFFBQVE7S0FDUixPQUFPO0tBQ1AsUUFBUTtLQUNSLFNBQVM7S0FDVCxZQUFZO0tBQ1osT0FBTztLQUNQLFFBQVE7S0FDUixjQUFjO0tBQ2QsVUFBVTtLQUNWLFlBQVk7S0FDWixRQUFRO0tBQ1IsV0FBVztLQUNYLFlBQVk7S0FDWixZQUFZO0lBQ2QsQ0FBQztJQUNELGVBQWUsaUJBQWlCLG9CQUFvQjtLQUNsRCxJQUFJLGdCQUFnQjtNQUNsQixlQUFlLE1BQU0sWUFBWTtNQUNqQyxlQUFlLE1BQU0sWUFBWTtLQUNuQztJQUNGLENBQUM7SUFDRCxlQUFlLGlCQUFpQixvQkFBb0I7S0FDbEQsSUFBSSxnQkFBZ0I7TUFDbEIsZUFBZSxNQUFNLFlBQVk7TUFDakMsZUFBZSxNQUFNLFlBQVk7S0FDbkM7SUFDRixDQUFDO0lBRUQsZUFBZSxpQkFBaUIsU0FBUyxjQUFjO0lBQ3ZELFNBQVMsS0FBSyxZQUFZLGNBQWM7R0FDMUM7R0FFQSxlQUFlLGlCQUFpQjtJQUM5QixJQUFJLFlBQVk7SUFDaEIsYUFBYTtJQUNiLElBQUksZ0JBQWdCLGVBQWUsY0FBYztJQUVqRCxJQUFJO0tBQ0YsTUFBTSxVQUFVLE1BQU0sT0FBTyxRQUFRLEtBQUssSUFBSSxjQUFjO0tBQzdDLENBQUE7TUFBRSxHQUFHO01BQWdCLEdBQUc7S0FBUTtLQUMvQyxNQUFNLFFBQVEscUJBQXFCO0tBQ25DLE1BQU0sYUFBYSxNQUFNLEtBQUksTUFBSyxFQUFFLFNBQVM7S0FDN0MsTUFBTSxZQUFvQyxDQUFDO0tBQzNDLE1BQU0sU0FBUSxNQUFLO01BQUUsVUFBVSxFQUFFLGFBQWEsRUFBRTtLQUFTLENBQUM7S0FFMUQsSUFBSSxXQUFXLFdBQVcsR0FBRztNQUMzQixJQUFJLGdCQUFnQixlQUFlLGNBQWM7TUFDakQsaUJBQWlCO09BQUUsSUFBSSxnQkFBZ0IsZUFBZSxjQUFjO01BQWUsR0FBRyxHQUFJO01BQzFGLGFBQWE7TUFDYjtLQUNGO0tBRUEsTUFBTSxVQUFVLG1CQUFtQjtLQUVuQyxPQUFPLFFBQVEsWUFBWTtNQUN6QixNQUFNO01BQ04sU0FBUztPQUNQO09BQ0E7T0FDQSxZQUFZLE9BQU8sU0FBUztPQUM1QixRQUFRLENBQUM7T0FDVDtPQUNBLFVBQVU7TUFDWjtLQUNGLENBQUM7SUFDSCxTQUFTLEtBQUs7S0FDWixRQUFRLE1BQU0sNkJBQTZCLEdBQUc7SUFDaEQsVUFBVTtLQUNSLGFBQWE7S0FDYixJQUFJLGdCQUFnQixlQUFlLGNBQWM7SUFDbkQ7R0FDRjtHQUVBLFNBQVMsWUFBWTtJQUNuQixJQUFJLFlBQVksS0FBSyxjQUFjLEdBQ2pDLGFBQWE7U0FDUjtLQUNMLGdCQUFnQixPQUFPO0tBQ3ZCLGlCQUFpQjtJQUNuQjtHQUNGO0dBRUEsVUFBVTtHQUVWLElBRHFCLGlCQUFpQixTQUN0QyxDQUFBLENBQVMsUUFBUSxTQUFTLE1BQU07SUFBRSxXQUFXO0lBQU0sU0FBUztHQUFLLENBQUM7RUFDcEU7Q0FDRixDQUFDOzs7Q0N2R0QsU0FBU0EsUUFBTSxRQUFRLEdBQUcsTUFBTTtFQUUvQixJQUFJLE9BQU8sS0FBSyxPQUFPLFVBQVUsT0FBTyxTQUFTLEtBQUssTUFBTSxLQUFLLEdBQUcsSUFBSTtPQUNuRSxPQUFPLFNBQVMsR0FBRyxJQUFJO0NBQzdCOztDQUVBLElBQU1DLFdBQVM7RUFDZCxRQUFRLEdBQUcsU0FBU0QsUUFBTSxRQUFRLE9BQU8sR0FBRyxJQUFJO0VBQ2hELE1BQU0sR0FBRyxTQUFTQSxRQUFNLFFBQVEsS0FBSyxHQUFHLElBQUk7RUFDNUMsT0FBTyxHQUFHLFNBQVNBLFFBQU0sUUFBUSxNQUFNLEdBQUcsSUFBSTtFQUM5QyxRQUFRLEdBQUcsU0FBU0EsUUFBTSxRQUFRLE9BQU8sR0FBRyxJQUFJO0NBQ2pEOzs7Ozs7Ozs7Ozs7Ozs7OztDRUlBLElBQU0sVURmaUIsV0FBVyxTQUFTLFNBQVMsS0FDaEQsV0FBVyxVQUNYLFdBQVc7OztDRURmLElBQUkseUJBQXlCLE1BQU0sK0JBQStCLE1BQU07RUFDdkUsT0FBTyxhQUFhLG1CQUFtQixvQkFBb0I7RUFDM0QsWUFBWSxRQUFRLFFBQVE7R0FDM0IsTUFBTSx1QkFBdUIsWUFBWSxDQUFDLENBQUM7R0FDM0MsS0FBSyxTQUFTO0dBQ2QsS0FBSyxTQUFTO0VBQ2Y7Q0FDRDs7Ozs7Q0FLQSxTQUFTLG1CQUFtQixXQUFXO0VBQ3RDLE9BQU8sR0FBRyxTQUFTLFNBQVMsR0FBRyxZQUFpQztDQUNqRTs7O0NDZEEsSUFBTSx3QkFBd0IsT0FBTyxXQUFXLFlBQVkscUJBQXFCOzs7Ozs7Q0FNakYsU0FBUyxzQkFBc0IsS0FBSztFQUNuQyxJQUFJO0VBQ0osSUFBSSxXQUFXO0VBQ2YsT0FBTyxFQUFFLE1BQU07R0FDZCxJQUFJLFVBQVU7R0FDZCxXQUFXO0dBQ1gsVUFBVSxJQUFJLElBQUksU0FBUyxJQUFJO0dBQy9CLElBQUksdUJBQXVCLFdBQVcsV0FBVyxpQkFBaUIsYUFBYSxVQUFVO0lBQ3hGLE1BQU0sU0FBUyxJQUFJLElBQUksTUFBTSxZQUFZLEdBQUc7SUFDNUMsSUFBSSxPQUFPLFNBQVMsUUFBUSxNQUFNO0lBQ2xDLE9BQU8sY0FBYyxJQUFJLHVCQUF1QixRQUFRLE9BQU8sQ0FBQztJQUNoRSxVQUFVO0dBQ1gsR0FBRyxFQUFFLFFBQVEsSUFBSSxPQUFPLENBQUM7UUFDcEIsSUFBSSxrQkFBa0I7SUFDMUIsTUFBTSxTQUFTLElBQUksSUFBSSxTQUFTLElBQUk7SUFDcEMsSUFBSSxPQUFPLFNBQVMsUUFBUSxNQUFNO0tBQ2pDLE9BQU8sY0FBYyxJQUFJLHVCQUF1QixRQUFRLE9BQU8sQ0FBQztLQUNoRSxVQUFVO0lBQ1g7R0FDRCxHQUFHLEdBQUc7RUFDUCxFQUFFO0NBQ0g7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NDUUEsSUFBSSx1QkFBdUIsTUFBTSxxQkFBcUI7RUFDckQsT0FBTyw4QkFBOEIsbUJBQW1CLDRCQUE0QjtFQUNwRjtFQUNBO0VBQ0Esa0JBQWtCLHNCQUFzQixJQUFJO0VBQzVDLFlBQVksbUJBQW1CLFNBQVM7R0FDdkMsS0FBSyxvQkFBb0I7R0FDekIsS0FBSyxVQUFVO0dBQ2YsS0FBSyxLQUFLLEtBQUssT0FBTyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUM7R0FDNUMsS0FBSyxrQkFBa0IsSUFBSSxnQkFBZ0I7R0FDM0MsS0FBSyxlQUFlO0dBQ3BCLEtBQUssc0JBQXNCO0VBQzVCO0VBQ0EsSUFBSSxTQUFTO0dBQ1osT0FBTyxLQUFLLGdCQUFnQjtFQUM3QjtFQUNBLE1BQU0sUUFBUTtHQUNiLE9BQU8sS0FBSyxnQkFBZ0IsTUFBTSxNQUFNO0VBQ3pDO0VBQ0EsSUFBSSxZQUFZO0dBQ2YsSUFBSSxRQUFRLFNBQVMsTUFBTSxNQUFNLEtBQUssa0JBQWtCO0dBQ3hELE9BQU8sS0FBSyxPQUFPO0VBQ3BCO0VBQ0EsSUFBSSxVQUFVO0dBQ2IsT0FBTyxDQUFDLEtBQUs7RUFDZDs7Ozs7Ozs7Ozs7Ozs7O0VBZUEsY0FBYyxJQUFJO0dBQ2pCLEtBQUssT0FBTyxpQkFBaUIsU0FBUyxFQUFFO0dBQ3hDLGFBQWEsS0FBSyxPQUFPLG9CQUFvQixTQUFTLEVBQUU7RUFDekQ7Ozs7Ozs7Ozs7OztFQVlBLFFBQVE7R0FDUCxPQUFPLElBQUksY0FBYyxDQUFDLENBQUM7RUFDNUI7Ozs7Ozs7RUFPQSxZQUFZLFNBQVMsU0FBUztHQUM3QixNQUFNLEtBQUssa0JBQWtCO0lBQzVCLElBQUksS0FBSyxTQUFTLFFBQVE7R0FDM0IsR0FBRyxPQUFPO0dBQ1YsS0FBSyxvQkFBb0IsY0FBYyxFQUFFLENBQUM7R0FDMUMsT0FBTztFQUNSOzs7Ozs7O0VBT0EsV0FBVyxTQUFTLFNBQVM7R0FDNUIsTUFBTSxLQUFLLGlCQUFpQjtJQUMzQixJQUFJLEtBQUssU0FBUyxRQUFRO0dBQzNCLEdBQUcsT0FBTztHQUNWLEtBQUssb0JBQW9CLGFBQWEsRUFBRSxDQUFDO0dBQ3pDLE9BQU87RUFDUjs7Ozs7Ozs7RUFRQSxzQkFBc0IsVUFBVTtHQUMvQixNQUFNLEtBQUssdUJBQXVCLEdBQUcsU0FBUztJQUM3QyxJQUFJLEtBQUssU0FBUyxTQUFTLEdBQUcsSUFBSTtHQUNuQyxDQUFDO0dBQ0QsS0FBSyxvQkFBb0IscUJBQXFCLEVBQUUsQ0FBQztHQUNqRCxPQUFPO0VBQ1I7Ozs7Ozs7O0VBUUEsb0JBQW9CLFVBQVUsU0FBUztHQUN0QyxNQUFNLEtBQUsscUJBQXFCLEdBQUcsU0FBUztJQUMzQyxJQUFJLENBQUMsS0FBSyxPQUFPLFNBQVMsU0FBUyxHQUFHLElBQUk7R0FDM0MsR0FBRyxPQUFPO0dBQ1YsS0FBSyxvQkFBb0IsbUJBQW1CLEVBQUUsQ0FBQztHQUMvQyxPQUFPO0VBQ1I7RUFDQSxpQkFBaUIsUUFBUSxNQUFNLFNBQVMsU0FBUztHQUNoRCxJQUFJLFNBQVM7UUFDUixLQUFLLFNBQVMsS0FBSyxnQkFBZ0IsSUFBSTtHQUFBO0dBRTVDLE9BQU8sbUJBQW1CLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSSxNQUFNLFNBQVM7SUFDN0YsR0FBRztJQUNILFFBQVEsS0FBSztHQUNkLENBQUM7RUFDRjs7Ozs7RUFLQSxvQkFBb0I7R0FDbkIsS0FBSyxNQUFNLG9DQUFvQztHQUMvQyxTQUFPLE1BQU0sbUJBQW1CLEtBQUssa0JBQWtCLHNCQUFzQjtFQUM5RTtFQUNBLGlCQUFpQjtHQUNoQixTQUFTLGNBQWMsSUFBSSxZQUFZLHFCQUFxQiw2QkFBNkIsRUFBRSxRQUFRO0lBQ2xHLG1CQUFtQixLQUFLO0lBQ3hCLFdBQVcsS0FBSztHQUNqQixFQUFFLENBQUMsQ0FBQztHQUNKLElBQUksQ0FBQyxLQUFLLFNBQVMsNEJBQTRCLE9BQU8sWUFBWTtJQUNqRSxNQUFNLHFCQUFxQjtJQUMzQixtQkFBbUIsS0FBSztJQUN4QixXQUFXLEtBQUs7R0FDakIsR0FBRyxHQUFHO0VBQ1A7RUFDQSx5QkFBeUIsT0FBTztHQUMvQixNQUFNLHNCQUFzQixNQUFNLFFBQVEsc0JBQXNCLEtBQUs7R0FDckUsTUFBTSxhQUFhLE1BQU0sUUFBUSxjQUFjLEtBQUs7R0FDcEQsT0FBTyx1QkFBdUIsQ0FBQztFQUNoQztFQUNBLHdCQUF3QjtHQUN2QixNQUFNLE1BQU0sVUFBVTtJQUNyQixJQUFJLEVBQUUsaUJBQWlCLGdCQUFnQixDQUFDLEtBQUsseUJBQXlCLEtBQUssR0FBRztJQUM5RSxLQUFLLGtCQUFrQjtHQUN4QjtHQUNBLFNBQVMsaUJBQWlCLHFCQUFxQiw2QkFBNkIsRUFBRTtHQUM5RSxLQUFLLG9CQUFvQixTQUFTLG9CQUFvQixxQkFBcUIsNkJBQTZCLEVBQUUsQ0FBQztFQUM1RztDQUNEIn0=