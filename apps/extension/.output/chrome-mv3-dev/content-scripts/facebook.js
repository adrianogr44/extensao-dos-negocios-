var facebook = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/define-content-script.mjs
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
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/internal/logger.mjs
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
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/browser.mjs
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
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/internal/custom-events.mjs
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
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/internal/location-watcher.mjs
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
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/content-script-context.mjs
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
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?C:/Users/adria/Desktop/postreels-v2/apps/extension/entrypoints/facebook.content.ts
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmFjZWJvb2suanMiLCJuYW1lcyI6WyJwcmludCIsImxvZ2dlciIsImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vc3JjL2xpYi9mYWNlYm9vay50cyIsIi4uLy4uLy4uL3NyYy9saWIvdHlwZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9mYWNlYm9vay5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLl9mYTZkZWZmYjBmMWQ1ZDQwYmI5NGRkZjNhNzUyYTNhMC9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC5fZmE2ZGVmZmIwZjFkNWQ0MGJiOTRkZGYzYTc1MmEzYTAvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLl9mYTZkZWZmYjBmMWQ1ZDQwYmI5NGRkZjNhNzUyYTNhMC9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCJleHBvcnQgaW50ZXJmYWNlIFJlZWxJbmZvIHtcclxuICBzaG9ydGNvZGU6IHN0cmluZ1xyXG4gIHZpZGVvVXJsOiBzdHJpbmdcclxuICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RSZWVsc0Zyb21QYWdlKCk6IFJlZWxJbmZvW10ge1xyXG4gIGNvbnN0IHJlZWxzOiBSZWVsSW5mb1tdID0gW11cclxuICBjb25zdCBsaW5rcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEFuY2hvckVsZW1lbnQ+KCdhW2hyZWYqPVwiL3JlZWwvXCJdJylcclxuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KClcclxuXHJcbiAgbGlua3MuZm9yRWFjaChsaW5rID0+IHtcclxuICAgIGNvbnN0IG1hdGNoID0gbGluay5ocmVmLm1hdGNoKC9cXC9yZWVsXFwvKFteLz9dKykvKVxyXG4gICAgaWYgKCFtYXRjaCkgcmV0dXJuXHJcbiAgICBjb25zdCBzaG9ydGNvZGUgPSBtYXRjaFsxXVxyXG4gICAgaWYgKHNlZW4uaGFzKHNob3J0Y29kZSkpIHJldHVyblxyXG4gICAgc2Vlbi5hZGQoc2hvcnRjb2RlKVxyXG5cclxuICAgIGNvbnN0IHZpZGVvID0gbGluay5xdWVyeVNlbGVjdG9yPEhUTUxWaWRlb0VsZW1lbnQ+KCd2aWRlbycpXHJcbiAgICByZWVscy5wdXNoKHtcclxuICAgICAgc2hvcnRjb2RlLFxyXG4gICAgICB2aWRlb1VybDogdmlkZW8/LnNyYyB8fCB2aWRlbz8ucXVlcnlTZWxlY3Rvcignc291cmNlJyk/LnNyYyB8fCAnJyxcclxuICAgICAgdGh1bWJuYWlsVXJsOiB2aWRlbz8ucG9zdGVyIHx8IHVuZGVmaW5lZCxcclxuICAgIH0pXHJcbiAgfSlcclxuXHJcbiAgcmV0dXJuIHJlZWxzXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxSZWVsTGlua3MoKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IGxpbmtzID0gbmV3IFNldDxzdHJpbmc+KClcclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PignYVtocmVmKj1cIi9yZWVsL1wiXScpLmZvckVhY2goYSA9PiB7XHJcbiAgICBjb25zdCBtYXRjaCA9IGEuaHJlZi5tYXRjaCgvXFwvcmVlbFxcLyhbXi8/XSspLylcclxuICAgIGlmIChtYXRjaCkgbGlua3MuYWRkKG1hdGNoWzFdKVxyXG4gIH0pXHJcbiAgcmV0dXJuIFsuLi5saW5rc11cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RQcm9maWxlSW5mbygpIHtcclxuICBjb25zdCB1cmwgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWVcclxuICBjb25zdCB1c2VybmFtZSA9IHVybC5zcGxpdCgnLycpLmZpbHRlcihCb29sZWFuKVswXSB8fCAnJ1xyXG4gIGNvbnN0IG5hbWVFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTE1ldGFFbGVtZW50PignbWV0YVtwcm9wZXJ0eT1cIm9nOnRpdGxlXCJdJylcclxuICBjb25zdCBmdWxsTmFtZSA9IG5hbWVFbD8uY29udGVudCB8fCB1c2VybmFtZVxyXG5cclxuICBsZXQgYXZhdGFyVXJsOiBzdHJpbmcgfCB1bmRlZmluZWRcclxuXHJcbiAgY29uc3QgbWV0YVNlbGVjdG9ycyA9IFtcclxuICAgICdtZXRhW3Byb3BlcnR5PVwib2c6aW1hZ2VcIl0nLFxyXG4gICAgJ21ldGFbbmFtZT1cInR3aXR0ZXI6aW1hZ2VcIl0nLFxyXG4gICAgJ2xpbmtbcmVsPVwiaW1hZ2Vfc3JjXCJdJyxcclxuICBdXHJcbiAgZm9yIChjb25zdCBzZWwgb2YgbWV0YVNlbGVjdG9ycykge1xyXG4gICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxNZXRhRWxlbWVudCB8IEhUTUxMaW5rRWxlbWVudD4oc2VsKVxyXG4gICAgaWYgKGVsKSB7XHJcbiAgICAgIGNvbnN0IHNyYyA9IChlbCBhcyBIVE1MTWV0YUVsZW1lbnQpLmNvbnRlbnQgfHwgKGVsIGFzIEhUTUxMaW5rRWxlbWVudCkuaHJlZlxyXG4gICAgICBpZiAoc3JjICYmICFzcmMuaW5jbHVkZXMoJ2Vtb2ppJykpIHsgYXZhdGFyVXJsID0gc3JjOyBicmVhayB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoIWF2YXRhclVybCkge1xyXG4gICAgY29uc3QgaW1nID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MSW1hZ2VFbGVtZW50PignaW1nW2RhdGEtdmlzdWFsY29tcGxldGlvbj1cImlnbm9yZS1keW5hbWljXCJdJylcclxuICAgIGlmIChpbWc/LnNyYyAmJiAhaW1nLnNyYy5pbmNsdWRlcygnZGF0YTonKSkgYXZhdGFyVXJsID0gaW1nLnNyY1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHsgdXNlcm5hbWUsIGZ1bGxOYW1lLCBhdmF0YXJVcmwgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNSZWVsc1BhZ2UoKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5pbmNsdWRlcygnL3JlZWxzLycpXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1Byb2ZpbGVQYWdlKCk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IHBhcnRzID0gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pXHJcbiAgcmV0dXJuIHBhcnRzLmxlbmd0aCA+PSAxICYmICFwYXJ0cy5pbmNsdWRlcygncmVlbCcpICYmICFwYXJ0cy5pbmNsdWRlcygncmVlbHMnKSAmJiAhcGFydHMuaW5jbHVkZXMoJ3N0b3JpZXMnKVxyXG59XHJcbiIsImV4cG9ydCBpbnRlcmZhY2UgUG9zdFJlZWxzQ29uZmlnIHtcclxuICBhcGlVcmw6IHN0cmluZ1xyXG4gIG1pbmlvRW5kcG9pbnQ6IHN0cmluZ1xyXG4gIG1pbmlvQWNjZXNzS2V5OiBzdHJpbmdcclxuICBtaW5pb1NlY3JldEtleTogc3RyaW5nXHJcbiAgbWluaW9CdWNrZXQ6IHN0cmluZ1xyXG4gIGNvbmN1cnJlbmN5OiBudW1iZXJcclxuICBzY3JvbGxEZWxheTogbnVtYmVyXHJcbiAgbWF4U2Nyb2xsczogbnVtYmVyXHJcbiAgbWF4RG93bmxvYWRzOiBudW1iZXJcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQcm9maWxlSW5mbyB7XHJcbiAgdXNlcm5hbWU6IHN0cmluZ1xyXG4gIGZ1bGxOYW1lOiBzdHJpbmdcclxuICBhdmF0YXJVcmw/OiBzdHJpbmdcclxuICBwb3N0c0NvdW50PzogbnVtYmVyXHJcbiAgZm9sbG93ZXJzQ291bnQ/OiBudW1iZXJcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQZW5kaW5nRG93bmxvYWQge1xyXG4gIHNob3J0Y29kZXM6IHN0cmluZ1tdXHJcbiAgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XHJcbiAgbmljaGVzOiBOaWNoZVtdXHJcbiAgcHJvZmlsZVVybDogc3RyaW5nXHJcbiAgcHJvZmlsZT86IFByb2ZpbGVJbmZvXHJcbiAgcGxhdGZvcm06IFBsYXRmb3JtXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVlbEluZm8ge1xyXG4gIHNob3J0Y29kZTogc3RyaW5nXHJcbiAgdmlkZW9Vcmw6IHN0cmluZ1xyXG4gIHRodW1ibmFpbFVybD86IHN0cmluZ1xyXG59XHJcblxyXG5leHBvcnQgdHlwZSBQbGF0Zm9ybSA9ICdJTlNUQUdSQU0nIHwgJ0ZBQ0VCT09LJyB8ICdZT1VUVUJFJ1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBEb3dubG9hZFRhc2sge1xyXG4gIGlkOiBzdHJpbmdcclxuICBzaG9ydGNvZGU6IHN0cmluZ1xyXG4gIHZpZGVvVXJsOiBzdHJpbmdcclxuICBuaWNoZUlkOiBzdHJpbmdcclxuICBwbGF0Zm9ybTogUGxhdGZvcm1cclxuICBzdGF0dXM6ICdxdWV1ZWQnIHwgJ2Rvd25sb2FkaW5nJyB8ICd1cGxvYWRpbmcnIHwgJ2NvbXBsZXRlZCcgfCAnZXJyb3InXHJcbiAgcHJvZ3Jlc3M6IG51bWJlclxyXG4gIGVycm9yPzogc3RyaW5nXHJcbiAgZmlsZW5hbWU/OiBzdHJpbmdcclxuICBjcmVhdGVkQXQ6IG51bWJlclxyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE5pY2hlIHtcclxuICBpZDogc3RyaW5nXHJcbiAgbm9tZTogc3RyaW5nXHJcbiAgY29yOiBzdHJpbmcgfCBudWxsXHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTkZJRzogUG9zdFJlZWxzQ29uZmlnID0ge1xyXG4gIGFwaVVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXHJcbiAgbWluaW9FbmRwb2ludDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXHJcbiAgbWluaW9BY2Nlc3NLZXk6ICdtaW5pb2FkbWluJyxcclxuICBtaW5pb1NlY3JldEtleTogJ21pbmlvYWRtaW4nLFxyXG4gIG1pbmlvQnVja2V0OiAncG9zdHJlZWxzLWRvd25sb2FkcycsXHJcbiAgY29uY3VycmVuY3k6IDMsXHJcbiAgc2Nyb2xsRGVsYXk6IDE1MDAsXHJcbiAgbWF4U2Nyb2xsczogNTAsXHJcbiAgbWF4RG93bmxvYWRzOiAyMCxcclxufVxyXG4iLCJpbXBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdCdcclxuaW1wb3J0IHsgZXh0cmFjdFJlZWxzRnJvbVBhZ2UsIGV4dHJhY3RQcm9maWxlSW5mbywgaXNSZWVsc1BhZ2UsIGlzUHJvZmlsZVBhZ2UgfSBmcm9tICcuLi9zcmMvbGliL2ZhY2Vib29rJ1xyXG5pbXBvcnQgeyBERUZBVUxUX0NPTkZJRyB9IGZyb20gJy4uL3NyYy9saWIvdHlwZXMnXHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcclxuICBtYXRjaGVzOiBbJ2h0dHBzOi8vd3d3LmZhY2Vib29rLmNvbS8qJ10sXHJcbiAgbWFpbigpIHtcclxuICAgIGxldCBkb3dubG9hZEJ1dHRvbjogSFRNTERpdkVsZW1lbnQgfCBudWxsID0gbnVsbFxyXG4gICAgbGV0IGlzU2Nhbm5pbmcgPSBmYWxzZVxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUJ1dHRvbigpIHtcclxuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSByZXR1cm5cclxuXHJcbiAgICAgIGRvd25sb2FkQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcclxuICAgICAgZG93bmxvYWRCdXR0b24uaWQgPSAncG9zdHJlZWxzLWRvd25sb2FkLWJ0bidcclxuICAgICAgZG93bmxvYWRCdXR0b24udGV4dENvbnRlbnQgPSAnQmFpeGFyIFJlZWxzJ1xyXG4gICAgICBPYmplY3QuYXNzaWduKGRvd25sb2FkQnV0dG9uLnN0eWxlLCB7XHJcbiAgICAgICAgcG9zaXRpb246ICdmaXhlZCcsXHJcbiAgICAgICAgYm90dG9tOiAnMjRweCcsXHJcbiAgICAgICAgcmlnaHQ6ICcyNHB4JyxcclxuICAgICAgICB6SW5kZXg6ICc5OTk5OTknLFxyXG4gICAgICAgIHBhZGRpbmc6ICcxMnB4IDIwcHgnLFxyXG4gICAgICAgIGJhY2tncm91bmQ6ICdsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCAjNjY3ZWVhIDAlLCAjNzY0YmEyIDEwMCUpJyxcclxuICAgICAgICBjb2xvcjogJyNmZmYnLFxyXG4gICAgICAgIGJvcmRlcjogJ25vbmUnLFxyXG4gICAgICAgIGJvcmRlclJhZGl1czogJzEycHgnLFxyXG4gICAgICAgIGZvbnRTaXplOiAnMTRweCcsXHJcbiAgICAgICAgZm9udFdlaWdodDogJzYwMCcsXHJcbiAgICAgICAgY3Vyc29yOiAncG9pbnRlcicsXHJcbiAgICAgICAgYm94U2hhZG93OiAnMCA4cHggMzJweCByZ2JhKDAsMCwwLDAuMyknLFxyXG4gICAgICAgIHRyYW5zaXRpb246ICd0cmFuc2Zvcm0gMC4ycywgYm94LXNoYWRvdyAwLjJzJyxcclxuICAgICAgICBmb250RmFtaWx5OiAnc3lzdGVtLXVpLCBzYW5zLXNlcmlmJyxcclxuICAgICAgfSlcclxuICAgICAgZG93bmxvYWRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignbW91c2VlbnRlcicsICgpID0+IHtcclxuICAgICAgICBpZiAoZG93bmxvYWRCdXR0b24pIHtcclxuICAgICAgICAgIGRvd25sb2FkQnV0dG9uLnN0eWxlLnRyYW5zZm9ybSA9ICdzY2FsZSgxLjA1KSdcclxuICAgICAgICAgIGRvd25sb2FkQnV0dG9uLnN0eWxlLmJveFNoYWRvdyA9ICcwIDEycHggNDBweCByZ2JhKDAsMCwwLDAuNCknXHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICBkb3dubG9hZEJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgKCkgPT4ge1xyXG4gICAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikge1xyXG4gICAgICAgICAgZG93bmxvYWRCdXR0b24uc3R5bGUudHJhbnNmb3JtID0gJ3NjYWxlKDEpJ1xyXG4gICAgICAgICAgZG93bmxvYWRCdXR0b24uc3R5bGUuYm94U2hhZG93ID0gJzAgOHB4IDMycHggcmdiYSgwLDAsMCwwLjMpJ1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuXHJcbiAgICAgIGRvd25sb2FkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgaGFuZGxlRG93bmxvYWQpXHJcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG93bmxvYWRCdXR0b24pXHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRG93bmxvYWQoKSB7XHJcbiAgICAgIGlmIChpc1NjYW5uaW5nKSByZXR1cm5cclxuICAgICAgaXNTY2FubmluZyA9IHRydWVcclxuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSBkb3dubG9hZEJ1dHRvbi50ZXh0Q29udGVudCA9ICdFc2NhbmVhbmRvLi4uJ1xyXG5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBzdG9yYWdlID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoREVGQVVMVF9DT05GSUcpXHJcbiAgICAgICAgY29uc3QgY29uZmlnID0geyAuLi5ERUZBVUxUX0NPTkZJRywgLi4uc3RvcmFnZSB9XHJcbiAgICAgICAgY29uc3QgcmVlbHMgPSBleHRyYWN0UmVlbHNGcm9tUGFnZSgpXHJcbiAgICAgICAgY29uc3Qgc2hvcnRjb2RlcyA9IHJlZWxzLm1hcChyID0+IHIuc2hvcnRjb2RlKVxyXG4gICAgICAgIGNvbnN0IHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XHJcbiAgICAgICAgcmVlbHMuZm9yRWFjaChyID0+IHsgdmlkZW9VcmxzW3Iuc2hvcnRjb2RlXSA9IHIudmlkZW9VcmwgfSlcclxuXHJcbiAgICAgICAgaWYgKHNob3J0Y29kZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICBpZiAoZG93bmxvYWRCdXR0b24pIGRvd25sb2FkQnV0dG9uLnRleHRDb250ZW50ID0gJ05lbmh1bSBSZWVsIGVuY29udHJhZG8nXHJcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHsgaWYgKGRvd25sb2FkQnV0dG9uKSBkb3dubG9hZEJ1dHRvbi50ZXh0Q29udGVudCA9ICdCYWl4YXIgUmVlbHMnIH0sIDIwMDApXHJcbiAgICAgICAgICBpc1NjYW5uaW5nID0gZmFsc2VcclxuICAgICAgICAgIHJldHVyblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcHJvZmlsZSA9IGV4dHJhY3RQcm9maWxlSW5mbygpXHJcblxyXG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICAgIHR5cGU6ICdET1dOTE9BRF9SRUVMUycsXHJcbiAgICAgICAgICBwYXlsb2FkOiB7XHJcbiAgICAgICAgICAgIHNob3J0Y29kZXMsXHJcbiAgICAgICAgICAgIHZpZGVvVXJscyxcclxuICAgICAgICAgICAgcHJvZmlsZVVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXHJcbiAgICAgICAgICAgIG5pY2hlczogW10sXHJcbiAgICAgICAgICAgIHByb2ZpbGUsXHJcbiAgICAgICAgICAgIHBsYXRmb3JtOiAnRkFDRUJPT0snLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9KVxyXG4gICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbRmFjZWJvb2sgQ29udGVudF0gRXJyb3I6JywgZXJyKVxyXG4gICAgICB9IGZpbmFsbHkge1xyXG4gICAgICAgIGlzU2Nhbm5pbmcgPSBmYWxzZVxyXG4gICAgICAgIGlmIChkb3dubG9hZEJ1dHRvbikgZG93bmxvYWRCdXR0b24udGV4dENvbnRlbnQgPSAnQmFpeGFyIFJlZWxzJ1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gY2hlY2tQYWdlKCkge1xyXG4gICAgICBpZiAoaXNSZWVsc1BhZ2UoKSB8fCBpc1Byb2ZpbGVQYWdlKCkpIHtcclxuICAgICAgICBjcmVhdGVCdXR0b24oKVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGRvd25sb2FkQnV0dG9uPy5yZW1vdmUoKVxyXG4gICAgICAgIGRvd25sb2FkQnV0dG9uID0gbnVsbFxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY2hlY2tQYWdlKClcclxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2hlY2tQYWdlKVxyXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KVxyXG4gIH0sXHJcbn0pXHJcbiIsIi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLnRzXG5mdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcblx0aWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuXHRpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIG1ldGhvZChgW3d4dF0gJHthcmdzLnNoaWZ0KCl9YCwgLi4uYXJncyk7XG5cdGVsc2UgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG59XG4vKiogV3JhcHBlciBhcm91bmQgYGNvbnNvbGVgIHdpdGggYSBcIlt3eHRdXCIgcHJlZml4ICovXG5jb25zdCBsb2dnZXIgPSB7XG5cdGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG5cdGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcblx0d2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG5cdGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxvZ2dlciB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy50c1xudmFyIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgPSBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuXHRzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcblx0Y29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcblx0XHRzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcblx0XHR0aGlzLm5ld1VybCA9IG5ld1VybDtcblx0XHR0aGlzLm9sZFVybCA9IG9sZFVybDtcblx0fVxufTtcbi8qKlxuKiBSZXR1cm5zIGFuIGV2ZW50IG5hbWUgdW5pcXVlIHRvIHRoZSBleHRlbnNpb24gYW5kIGNvbnRlbnQgc2NyaXB0IHRoYXQnc1xuKiBydW5uaW5nLlxuKi9cbmZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcblx0cmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LCBnZXRVbmlxdWVFdmVudE5hbWUgfTtcbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLnRzXG5jb25zdCBzdXBwb3J0c05hdmlnYXRpb25BcGkgPSB0eXBlb2YgZ2xvYmFsVGhpcy5uYXZpZ2F0aW9uPy5hZGRFdmVudExpc3RlbmVyID09PSBcImZ1bmN0aW9uXCI7XG4vKipcbiogQ3JlYXRlIGEgdXRpbCB0aGF0IHdhdGNoZXMgZm9yIFVSTCBjaGFuZ2VzLCBkaXNwYXRjaGluZyB0aGUgY3VzdG9tIGV2ZW50IHdoZW5cbiogZGV0ZWN0ZWQuIFN0b3BzIHdhdGNoaW5nIHdoZW4gY29udGVudCBzY3JpcHQgaXMgaW52YWxpZGF0ZWQuIFVzZXMgTmF2aWdhdGlvblxuKiBBUEkgd2hlbiBhdmFpbGFibGUsIG90aGVyd2lzZSBmYWxscyBiYWNrIHRvIHBvbGxpbmcuXG4qL1xuZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuXHRsZXQgbGFzdFVybDtcblx0bGV0IHdhdGNoaW5nID0gZmFsc2U7XG5cdHJldHVybiB7IHJ1bigpIHtcblx0XHRpZiAod2F0Y2hpbmcpIHJldHVybjtcblx0XHR3YXRjaGluZyA9IHRydWU7XG5cdFx0bGFzdFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0aWYgKHN1cHBvcnRzTmF2aWdhdGlvbkFwaSkgZ2xvYmFsVGhpcy5uYXZpZ2F0aW9uLmFkZEV2ZW50TGlzdGVuZXIoXCJuYXZpZ2F0ZVwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwoZXZlbnQuZGVzdGluYXRpb24udXJsKTtcblx0XHRcdGlmIChuZXdVcmwuaHJlZiA9PT0gbGFzdFVybC5ocmVmKSByZXR1cm47XG5cdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdGxhc3RVcmwgPSBuZXdVcmw7XG5cdFx0fSwgeyBzaWduYWw6IGN0eC5zaWduYWwgfSk7XG5cdFx0ZWxzZSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcblx0XHRcdGlmIChuZXdVcmwuaHJlZiAhPT0gbGFzdFVybC5ocmVmKSB7XG5cdFx0XHRcdHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgbGFzdFVybCkpO1xuXHRcdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdFx0fVxuXHRcdH0sIDFlMyk7XG5cdH0gfTtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH07XG4iLCJpbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBnZXRVbmlxdWVFdmVudE5hbWUgfSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC50c1xuLyoqXG4qIEltcGxlbWVudHNcbiogW2BBYm9ydENvbnRyb2xsZXJgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQWJvcnRDb250cm9sbGVyKS5cbiogVXNlZCB0byBkZXRlY3QgYW5kIHN0b3AgY29udGVudCBzY3JpcHQgY29kZSB3aGVuIHRoZSBzY3JpcHQgaXMgaW52YWxpZGF0ZWQuXG4qXG4qIEl0IGFsc28gcHJvdmlkZXMgc2V2ZXJhbCB1dGlsaXRpZXMgbGlrZSBgY3R4LnNldFRpbWVvdXRgIGFuZFxuKiBgY3R4LnNldEludGVydmFsYCB0aGF0IHNob3VsZCBiZSB1c2VkIGluIGNvbnRlbnQgc2NyaXB0cyBpbnN0ZWFkIG9mXG4qIGB3aW5kb3cuc2V0VGltZW91dGAgb3IgYHdpbmRvdy5zZXRJbnRlcnZhbGAuXG4qXG4qIFRvIGNyZWF0ZSBjb250ZXh0IGZvciB0ZXN0aW5nLCB5b3UgY2FuIHVzZSB0aGUgY2xhc3MncyBjb25zdHJ1Y3RvcjpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHRzLWNvbnRleHQnO1xuKlxuKiB0ZXN0KCdzdG9yYWdlIGxpc3RlbmVyIHNob3VsZCBiZSByZW1vdmVkIHdoZW4gY29udGV4dCBpcyBpbnZhbGlkYXRlZCcsICgpID0+IHtcbiogICBjb25zdCBjdHggPSBuZXcgQ29udGVudFNjcmlwdENvbnRleHQoJ3Rlc3QnKTtcbiogICBjb25zdCBpdGVtID0gc3RvcmFnZS5kZWZpbmVJdGVtKCdsb2NhbDpjb3VudCcsIHsgZGVmYXVsdFZhbHVlOiAwIH0pO1xuKiAgIGNvbnN0IHdhdGNoZXIgPSB2aS5mbigpO1xuKlxuKiAgIGNvbnN0IHVud2F0Y2ggPSBpdGVtLndhdGNoKHdhdGNoZXIpO1xuKiAgIGN0eC5vbkludmFsaWRhdGVkKHVud2F0Y2gpOyAvLyBMaXN0ZW4gZm9yIGludmFsaWRhdGUgaGVyZVxuKlxuKiAgIGF3YWl0IGl0ZW0uc2V0VmFsdWUoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRUaW1lcygxKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFdpdGgoMSwgMCk7XG4qXG4qICAgY3R4Lm5vdGlmeUludmFsaWRhdGVkKCk7IC8vIFVzZSB0aGlzIGZ1bmN0aW9uIHRvIGludmFsaWRhdGUgdGhlIGNvbnRleHRcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDIpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qIH0pO1xuKiBgYGBcbiovXG52YXIgQ29udGVudFNjcmlwdENvbnRleHQgPSBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG5cdHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiKTtcblx0aWQ7XG5cdGFib3J0Q29udHJvbGxlcjtcblx0bG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuXHRjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuXHRcdHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuaWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKTtcblx0XHR0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0XHR0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG5cdFx0dGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcblx0fVxuXHRnZXQgc2lnbmFsKCkge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG5cdH1cblx0YWJvcnQocmVhc29uKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG5cdH1cblx0Z2V0IGlzSW52YWxpZCgpIHtcblx0XHRpZiAoYnJvd3Nlci5ydW50aW1lPy5pZCA9PSBudWxsKSB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG5cdFx0cmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG5cdH1cblx0Z2V0IGlzVmFsaWQoKSB7XG5cdFx0cmV0dXJuICF0aGlzLmlzSW52YWxpZDtcblx0fVxuXHQvKipcblx0KiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXNcblx0KiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIEBleGFtcGxlXG5cdCogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcblx0KiAgIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG5cdCogICAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuXHQqICAgfSk7XG5cdCogICAvLyAuLi5cblx0KiAgIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcblx0KlxuXHQqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cblx0Ki9cblx0b25JbnZhbGlkYXRlZChjYikge1xuXHRcdHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG5cdFx0cmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG5cdH1cblx0LyoqXG5cdCogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb25cblx0KiB0aGF0IHNob3VsZG4ndCBydW4gYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cblx0KlxuXHQqIEBleGFtcGxlXG5cdCogICBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuXHQqICAgICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuXHQqXG5cdCogICAgIC8vIC4uLlxuXHQqICAgfTtcblx0Ki9cblx0YmxvY2soKSB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHt9KTtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbFxuXHQqIHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cblx0Ki9cblx0c2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cblx0Ki9cblx0c2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG5cdFx0Y29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2Vsc1xuXHQqIHRoZSByZXF1ZXN0IHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgXG5cdCogZnVuY3Rpb24uXG5cdCovXG5cdHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGVcblx0KiByZXF1ZXN0IHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuXHRcdH0sIG9wdGlvbnMpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0YWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcblx0XHRpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG5cdFx0fVxuXHRcdHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4odHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsIGhhbmRsZXIsIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRzaWduYWw6IHRoaXMuc2lnbmFsXG5cdFx0fSk7XG5cdH1cblx0LyoqXG5cdCogQGludGVybmFsXG5cdCogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG5cdCovXG5cdG5vdGlmeUludmFsaWRhdGVkKCkge1xuXHRcdHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuXHRcdGxvZ2dlci5kZWJ1ZyhgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGApO1xuXHR9XG5cdHN0b3BPbGRTY3JpcHRzKCkge1xuXHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgeyBkZXRhaWw6IHtcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSB9KSk7XG5cdFx0aWYgKCF0aGlzLm9wdGlvbnM/Lm5vU2NyaXB0U3RhcnRlZFBvc3RNZXNzYWdlKSB3aW5kb3cucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0dHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuXHRcdFx0Y29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG5cdFx0XHRtZXNzYWdlSWQ6IHRoaXMuaWRcblx0XHR9LCBcIipcIik7XG5cdH1cblx0dmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG5cdFx0Y29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRldGFpbD8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG5cdFx0Y29uc3QgaXNGcm9tU2VsZiA9IGV2ZW50LmRldGFpbD8ubWVzc2FnZUlkID09PSB0aGlzLmlkO1xuXHRcdHJldHVybiBpc1NhbWVDb250ZW50U2NyaXB0ICYmICFpc0Zyb21TZWxmO1xuXHR9XG5cdGxpc3RlbkZvck5ld2VyU2NyaXB0cygpIHtcblx0XHRjb25zdCBjYiA9IChldmVudCkgPT4ge1xuXHRcdFx0aWYgKCEoZXZlbnQgaW5zdGFuY2VvZiBDdXN0b21FdmVudCkgfHwgIXRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkgcmV0dXJuO1xuXHRcdFx0dGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdH07XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIGNiKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIGNiKSk7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNCw1LDYsNyw4LDldLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLG9CQUFvQixZQUFZO0VBQ3hDLE9BQU87Q0FDUjs7O0NDR0EsU0FBZ0IsdUJBQW1DO0VBQ2pELE1BQU0sUUFBb0IsQ0FBQztFQUMzQixNQUFNLFFBQVEsU0FBUyxpQkFBb0MscUJBQW1CO0VBQzlFLE1BQU0sdUJBQU8sSUFBSSxJQUFZO0VBRTdCLE1BQU0sU0FBUSxTQUFRO0dBQ3BCLE1BQU0sUUFBUSxLQUFLLEtBQUssTUFBTSxrQkFBa0I7R0FDaEQsSUFBSSxDQUFDLE9BQU87R0FDWixNQUFNLFlBQVksTUFBTTtHQUN4QixJQUFJLEtBQUssSUFBSSxTQUFTLEdBQUc7R0FDekIsS0FBSyxJQUFJLFNBQVM7R0FFbEIsTUFBTSxRQUFRLEtBQUssY0FBZ0MsT0FBTztHQUMxRCxNQUFNLEtBQUs7SUFDVDtJQUNBLFVBQVUsT0FBTyxPQUFPLE9BQU8sY0FBYyxRQUFRLENBQUMsRUFBRSxPQUFPO0lBQy9ELGNBQWMsT0FBTyxVQUFVLEtBQUE7R0FDakMsQ0FBQztFQUNILENBQUM7RUFFRCxPQUFPO0NBQ1Q7Q0FXQSxTQUFnQixxQkFBcUI7RUFFbkMsTUFBTSxXQURNLE9BQU8sU0FBUyxTQUNQLE1BQU0sR0FBRyxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsQ0FBQyxNQUFNO0VBRXRELE1BQU0sV0FEUyxTQUFTLGNBQStCLDZCQUN0QyxDQUFBLEVBQVEsV0FBVztFQUVwQyxJQUFJO0VBT0osS0FBSyxNQUFNLE9BQU87R0FKaEI7R0FDQTtHQUNBO0VBRWdCLEdBQWU7R0FDL0IsTUFBTSxLQUFLLFNBQVMsY0FBaUQsR0FBRztHQUN4RSxJQUFJLElBQUk7SUFDTixNQUFNLE1BQU8sR0FBdUIsV0FBWSxHQUF1QjtJQUN2RSxJQUFJLE9BQU8sQ0FBQyxJQUFJLFNBQVMsT0FB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