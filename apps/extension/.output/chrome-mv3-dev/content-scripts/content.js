var content = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/define-content-script.mjs
	function defineContentScript(definition) {
		return definition;
	}
	//#endregion
	//#region src/lib/instagram.ts
	function extractReelsFromPage() {
		const reels = [];
		const seen = /* @__PURE__ */ new Set();
		document.querySelectorAll("a[href*=\"/reel/\"]").forEach((link) => {
			const href = link.getAttribute("href");
			if (!href) return;
			const match = href.match(/\/reel\/([^/?]+)/);
			if (!match || seen.has(match[1])) return;
			seen.add(match[1]);
			const shortcode = match[1];
			let videoUrl = "";
			let thumbnailUrl;
			let current = link;
			while (current && !videoUrl) {
				const video = current.querySelector("video");
				if (video) {
					const source = video.querySelector("source[type=\"video/mp4\"]");
					if (source) videoUrl = source.getAttribute("src") || "";
					if (!videoUrl && video.src) videoUrl = video.src;
					if (!videoUrl) {
						const dataSrc = video.getAttribute("data-src");
						if (dataSrc) videoUrl = dataSrc;
					}
					thumbnailUrl = video.getAttribute("poster") || void 0;
					break;
				}
				const img = current.querySelector("img[src*=\"cdninstagram\"]");
				if (img && !thumbnailUrl) thumbnailUrl = img.getAttribute("src") || void 0;
				current = current.parentElement;
			}
			reels.push({
				shortcode,
				videoUrl,
				thumbnailUrl
			});
		});
		return reels;
	}
	function extractProfileInfo() {
		const info = {
			username: "",
			fullName: "",
			avatarUrl: "",
			postsCount: 0,
			followersCount: 0
		};
		const pathParts = window.location.pathname.split("/").filter(Boolean);
		if (pathParts.length > 0) info.username = pathParts[0];
		const ldScript = document.querySelector("script[type=\"application/ld+json\"]");
		if (ldScript) try {
			const ld = JSON.parse(ldScript.textContent || "{}");
			if (ld.name) info.fullName = ld.name;
			if (ld.url) info.username = ld.url.split("/").filter(Boolean).pop() || info.username;
			if (ld.description) {
				const postMatch = ld.description.match(/([\d,.]+)\s*[Pp]ublicaç/);
				const followerMatch = ld.description.match(/([\d,.]+)\s*[Ss]eguidor/);
				if (postMatch) info.postsCount = parseCount(postMatch[1]);
				if (followerMatch) info.followersCount = parseCount(followerMatch[1]);
			}
		} catch {}
		if (!info.fullName) {
			const metaTitle = document.querySelector("meta[property=\"og:title\"]");
			if (metaTitle) info.fullName = metaTitle.getAttribute("content")?.split("(")[0]?.trim() || "";
		}
		const avatarSelectors = [
			"meta[property=\"og:image\"]",
			"img[alt*=\"" + info.username + "\"]",
			"img[data-testid=\"user-avatar\"]",
			"header img[src*=\"scontent\"]",
			"img[src*=\"scontent\"][src*=\"cdninstagram\"]",
			"section main img[src*=\"scontent\"]",
			"article header img[src*=\"scontent\"]"
		];
		for (const sel of avatarSelectors) {
			const el = document.querySelector(sel);
			if (el) {
				const src = sel === "meta[property=\"og:image\"]" ? el.content : el.src;
				if (src && src.startsWith("http")) {
					info.avatarUrl = src;
					break;
				}
			}
		}
		return info;
	}
	function parseCount(str) {
		return parseInt(str.replace(/[,.]/g, "")) || 0;
	}
	function isReelsPage() {
		return window.location.pathname.includes("/reels/");
	}
	function isProfilePage() {
		const parts = window.location.pathname.split("/").filter(Boolean);
		if (parts.length === 0) return false;
		const first = parts[0];
		if (first === "explore" || first === "reel" || first === "p" || first === "stories" || first === "direct") return false;
		return parts.length <= 2;
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
	//#region entrypoints/content.ts
	var content_default = defineContentScript({
		matches: ["https://www.instagram.com/*"],
		main() {
			let downloadButton = null;
			let isScanning = false;
			function injectToolbar() {
				if (downloadButton) return;
				if (!isReelsPage() && !isProfilePage()) return;
				downloadButton = document.createElement("div");
				downloadButton.innerHTML = `
        <div style="
          position:fixed;bottom:24px;right:24px;z-index:99999;
          display:flex;flex-direction:column;gap:8px;
          font-family:sans-serif;
        ">
          <button id="pr-scan-btn" style="
            background:#0095f6;color:white;border:none;
            padding:12px 20px;border-radius:8px;
            font-size:14px;font-weight:600;cursor:pointer;
            box-shadow:0 4px 12px rgba(0,149,246,0.4);
            transition:transform 0.2s;
          ">📥 Baixar Reels</button>
          <div id="pr-status" style="
            background:#1a1a2e;color:#e0e0e0;border-radius:8px;
            padding:8px 12px;font-size:12px;display:none;
            max-width:280px;
          "></div>
        </div>
      `;
				document.body.appendChild(downloadButton);
				document.getElementById("pr-scan-btn")?.addEventListener("click", startScan);
			}
			function collectReels() {
				const reels = extractReelsFromPage();
				const shortcodes = [];
				const videoUrls = {};
				for (const reel of reels) {
					shortcodes.push(reel.shortcode);
					if (reel.videoUrl) videoUrls[reel.shortcode] = reel.videoUrl;
				}
				return {
					shortcodes,
					videoUrls
				};
			}
			function mergeReels(existing, incoming) {
				for (const sc of incoming.shortcodes) {
					existing.shortcodes.add(sc);
					if (incoming.videoUrls[sc]) existing.videoUrls[sc] = incoming.videoUrls[sc];
				}
			}
			async function readConfig() {
				try {
					const result = await chrome.storage.sync.get("postreelsConfig");
					return {
						...DEFAULT_CONFIG,
						...result.postreelsConfig
					};
				} catch {
					return DEFAULT_CONFIG;
				}
			}
			async function startScan() {
				if (isScanning) return;
				isScanning = true;
				const statusEl = document.getElementById("pr-status");
				if (!statusEl) return;
				statusEl.style.display = "block";
				statusEl.textContent = "🔍 Iniciando varredura...";
				const config = await readConfig();
				const shortcodes = /* @__PURE__ */ new Set();
				const videoUrls = {};
				mergeReels({
					shortcodes,
					videoUrls
				}, collectReels());
				statusEl.textContent = `🔍 Encontrados ${shortcodes.size} vídeos... Rolando página`;
				let scrollCount = 0;
				const noNewLimit = 5;
				while (shortcodes.size < config.maxDownloads && scrollCount < config.maxScrolls) {
					const before = shortcodes.size;
					window.scrollBy(0, 1500);
					await new Promise((r) => setTimeout(r, config.scrollDelay));
					mergeReels({
						shortcodes,
						videoUrls
					}, collectReels());
					if (shortcodes.size === before) {
						if (++scrollCount >= noNewLimit) break;
						continue;
					}
					statusEl.textContent = `🔍 Encontrados ${shortcodes.size} vídeos... Rolando (${scrollCount + 1}/${config.maxScrolls})`;
					scrollCount = 0;
				}
				statusEl.textContent = `✅ ${shortcodes.size} vídeos encontrados!`;
				const profile = extractProfileInfo();
				let niches = [];
				try {
					const res = await fetch("http://localhost:3000/api/nichos", {
						method: "GET",
						headers: { "Accept": "application/json" }
					});
					if (res.ok) {
						const data = await res.json();
						if (data.success && data.data) niches = data.data;
					}
				} catch (err) {
					console.warn("[Content] Aviso ao carregar nichos (será recarregado no popup):", err);
				}
				chrome.runtime.sendMessage({
					type: "DOWNLOAD_REELS",
					payload: {
						shortcodes: Array.from(shortcodes),
						videoUrls,
						profileUrl: window.location.href,
						niches,
						profile,
						platform: "INSTAGRAM"
					}
				}, (response) => {
					console.log("[Content] Resposta do background:", response);
					if (response?.success) statusEl.textContent = `✅ ${shortcodes.size} vídeos encontrados! Verifique o popup da extensão.`;
					else statusEl.textContent = `❌ Erro ao enviar para download`;
				});
				isScanning = false;
			}
			function tryInject() {
				if (isReelsPage() || isProfilePage()) injectToolbar();
			}
			tryInject();
			new MutationObserver(() => {
				if (!downloadButton || !document.body.contains(downloadButton)) {
					downloadButton = null;
					tryInject();
				}
			}).observe(document.body, {
				childList: true,
				subtree: true
			});
			let lastUrl = location.href;
			new MutationObserver(() => {
				if (location.href !== lastUrl) {
					lastUrl = location.href;
					setTimeout(tryInject, 1e3);
				}
			}).observe(document.body, {
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
		return `${browser?.runtime?.id}:content:${eventName}`;
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
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?C:/Users/adria/Desktop/postreels-v2/apps/extension/entrypoints/content.ts
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
			const { main, ...options } = content_default;
			return await main(new ContentScriptContext("content", options));
		} catch (err) {
			logger.error(`The content script "content" crashed on startup!`, err);
			throw err;
		}
	})();
})();

content;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsIm5hbWVzIjpbInByaW50IiwibG9nZ2VyIiwiYnJvd3NlciJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC5fZmE2ZGVmZmIwZjFkNWQ0MGJiOTRkZGYzYTc1MmEzYTAvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvbGliL2luc3RhZ3JhbS50cyIsIi4uLy4uLy4uL3NyYy9saWIvdHlwZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLl9mYTZkZWZmYjBmMWQ1ZDQwYmI5NGRkZjNhNzUyYTNhMC9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC5fZmE2ZGVmZmIwZjFkNWQ0MGJiOTRkZGYzYTc1MmEzYTAvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLl9mYTZkZWZmYjBmMWQ1ZDQwYmI5NGRkZjNhNzUyYTNhMC9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCJpbXBvcnQgdHlwZSB7IFJlZWxJbmZvIH0gZnJvbSAnLi90eXBlcydcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0UmVlbHNGcm9tUGFnZSgpOiBSZWVsSW5mb1tdIHtcclxuICBjb25zdCByZWVsczogUmVlbEluZm9bXSA9IFtdXHJcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpXHJcblxyXG4gIGNvbnN0IGxpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYVtocmVmKj1cIi9yZWVsL1wiXScpXHJcblxyXG4gIGxpbmtzLmZvckVhY2gobGluayA9PiB7XHJcbiAgICBjb25zdCBocmVmID0gbGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKVxyXG4gICAgaWYgKCFocmVmKSByZXR1cm5cclxuXHJcbiAgICBjb25zdCBtYXRjaCA9IGhyZWYubWF0Y2goL1xcL3JlZWxcXC8oW14vP10rKS8pXHJcbiAgICBpZiAoIW1hdGNoIHx8IHNlZW4uaGFzKG1hdGNoWzFdKSkgcmV0dXJuXHJcbiAgICBzZWVuLmFkZChtYXRjaFsxXSlcclxuXHJcbiAgICBjb25zdCBzaG9ydGNvZGUgPSBtYXRjaFsxXVxyXG5cclxuICAgIGxldCB2aWRlb1VybCA9ICcnXHJcbiAgICBsZXQgdGh1bWJuYWlsVXJsOiBzdHJpbmcgfCB1bmRlZmluZWRcclxuXHJcbiAgICBsZXQgY3VycmVudDogRWxlbWVudCB8IG51bGwgPSBsaW5rXHJcbiAgICB3aGlsZSAoY3VycmVudCAmJiAhdmlkZW9VcmwpIHtcclxuICAgICAgY29uc3QgdmlkZW8gPSBjdXJyZW50LnF1ZXJ5U2VsZWN0b3IoJ3ZpZGVvJylcclxuICAgICAgaWYgKHZpZGVvKSB7XHJcbiAgICAgICAgY29uc3Qgc291cmNlID0gdmlkZW8ucXVlcnlTZWxlY3Rvcignc291cmNlW3R5cGU9XCJ2aWRlby9tcDRcIl0nKVxyXG4gICAgICAgIGlmIChzb3VyY2UpIHtcclxuICAgICAgICAgIHZpZGVvVXJsID0gc291cmNlLmdldEF0dHJpYnV0ZSgnc3JjJykgfHwgJydcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF2aWRlb1VybCAmJiB2aWRlby5zcmMpIHtcclxuICAgICAgICAgIHZpZGVvVXJsID0gdmlkZW8uc3JjXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdmlkZW9VcmwpIHtcclxuICAgICAgICAgIGNvbnN0IGRhdGFTcmMgPSB2aWRlby5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJylcclxuICAgICAgICAgIGlmIChkYXRhU3JjKSB2aWRlb1VybCA9IGRhdGFTcmNcclxuICAgICAgICB9XHJcbiAgICAgICAgdGh1bWJuYWlsVXJsID0gdmlkZW8uZ2V0QXR0cmlidXRlKCdwb3N0ZXInKSB8fCB1bmRlZmluZWRcclxuICAgICAgICBicmVha1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnN0IGltZyA9IGN1cnJlbnQucXVlcnlTZWxlY3RvcignaW1nW3NyYyo9XCJjZG5pbnN0YWdyYW1cIl0nKVxyXG4gICAgICBpZiAoaW1nICYmICF0aHVtYm5haWxVcmwpIHtcclxuICAgICAgICB0aHVtYm5haWxVcmwgPSBpbWcuZ2V0QXR0cmlidXRlKCdzcmMnKSB8fCB1bmRlZmluZWRcclxuICAgICAgfVxyXG4gICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnRFbGVtZW50XHJcbiAgICB9XHJcblxyXG4gICAgcmVlbHMucHVzaCh7XHJcbiAgICAgIHNob3J0Y29kZSxcclxuICAgICAgdmlkZW9VcmwsXHJcbiAgICAgIHRodW1ibmFpbFVybCxcclxuICAgIH0pXHJcbiAgfSlcclxuXHJcbiAgcmV0dXJuIHJlZWxzXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxSZWVsTGlua3MoKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IGxpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYVtocmVmKj1cIi9yZWVsL1wiXScpXHJcbiAgY29uc3Qgc2hvcnRjb2RlcyA9IG5ldyBTZXQ8c3RyaW5nPigpXHJcbiAgbGlua3MuZm9yRWFjaChsaW5rID0+IHtcclxuICAgIGNvbnN0IGhyZWYgPSBsaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpXHJcbiAgICBpZiAoIWhyZWYpIHJldHVyblxyXG4gICAgY29uc3QgbWF0Y2ggPSBocmVmLm1hdGNoKC9cXC9yZWVsXFwvKFteLz9dKykvKVxyXG4gICAgaWYgKG1hdGNoKSBzaG9ydGNvZGVzLmFkZChtYXRjaFsxXSlcclxuICB9KVxyXG4gIHJldHVybiBBcnJheS5mcm9tKHNob3J0Y29kZXMpXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0UHJvZmlsZUluZm8oKSB7XHJcbiAgY29uc3QgaW5mbyA9IHsgdXNlcm5hbWU6ICcnLCBmdWxsTmFtZTogJycsIGF2YXRhclVybDogJycsIHBvc3RzQ291bnQ6IDAsIGZvbGxvd2Vyc0NvdW50OiAwIH1cclxuXHJcbiAgLy8gdXNlcm5hbWUgZnJvbSBVUkxcclxuICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbilcclxuICBpZiAocGF0aFBhcnRzLmxlbmd0aCA+IDApIGluZm8udXNlcm5hbWUgPSBwYXRoUGFydHNbMF1cclxuXHJcbiAgLy8gVHJ5IEpTT04tTEQgKHN0cnVjdHVyZWQgZGF0YSBpbmplY3RlZCBieSBJbnN0YWdyYW0pXHJcbiAgY29uc3QgbGRTY3JpcHQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdzY3JpcHRbdHlwZT1cImFwcGxpY2F0aW9uL2xkK2pzb25cIl0nKVxyXG4gIGlmIChsZFNjcmlwdCkge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgbGQgPSBKU09OLnBhcnNlKGxkU2NyaXB0LnRleHRDb250ZW50IHx8ICd7fScpXHJcbiAgICAgIGlmIChsZC5uYW1lKSBpbmZvLmZ1bGxOYW1lID0gbGQubmFtZVxyXG4gICAgICBpZiAobGQudXJsKSBpbmZvLnVzZXJuYW1lID0gbGQudXJsLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pLnBvcCgpIHx8IGluZm8udXNlcm5hbWVcclxuICAgICAgaWYgKGxkLmRlc2NyaXB0aW9uKSB7XHJcbiAgICAgICAgY29uc3QgcG9zdE1hdGNoID0gbGQuZGVzY3JpcHRpb24ubWF0Y2goLyhbXFxkLC5dKylcXHMqW1BwXXVibGljYcOnLylcclxuICAgICAgICBjb25zdCBmb2xsb3dlck1hdGNoID0gbGQuZGVzY3JpcHRpb24ubWF0Y2goLyhbXFxkLC5dKylcXHMqW1NzXWVndWlkb3IvKVxyXG4gICAgICAgIGlmIChwb3N0TWF0Y2gpIGluZm8ucG9zdHNDb3VudCA9IHBhcnNlQ291bnQocG9zdE1hdGNoWzFdKVxyXG4gICAgICAgIGlmIChmb2xsb3dlck1hdGNoKSBpbmZvLmZvbGxvd2Vyc0NvdW50ID0gcGFyc2VDb3VudChmb2xsb3dlck1hdGNoWzFdKVxyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIHt9XHJcbiAgfVxyXG5cclxuICAvLyBGYWxsYmFjazogc2NyYXBlIG1ldGEgdGFncyBhbmQgdmlzaWJsZSBlbGVtZW50c1xyXG4gIGlmICghaW5mby5mdWxsTmFtZSkge1xyXG4gICAgY29uc3QgbWV0YVRpdGxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtwcm9wZXJ0eT1cIm9nOnRpdGxlXCJdJylcclxuICAgIGlmIChtZXRhVGl0bGUpIGluZm8uZnVsbE5hbWUgPSBtZXRhVGl0bGUuZ2V0QXR0cmlidXRlKCdjb250ZW50Jyk/LnNwbGl0KCcoJylbMF0/LnRyaW0oKSB8fCAnJ1xyXG4gIH1cclxuXHJcbiAgLy8gQXZhdGFyOiB0cnkgbXVsdGlwbGUgc2VsZWN0b3JzIHVzZWQgYnkgSW5zdGFncmFtJ3MgY3VycmVudCBET01cclxuICBjb25zdCBhdmF0YXJTZWxlY3RvcnMgPSBbXHJcbiAgICAnbWV0YVtwcm9wZXJ0eT1cIm9nOmltYWdlXCJdJyxcclxuICAgICdpbWdbYWx0Kj1cIicgKyBpbmZvLnVzZXJuYW1lICsgJ1wiXScsXHJcbiAgICAnaW1nW2RhdGEtdGVzdGlkPVwidXNlci1hdmF0YXJcIl0nLFxyXG4gICAgJ2hlYWRlciBpbWdbc3JjKj1cInNjb250ZW50XCJdJyxcclxuICAgICdpbWdbc3JjKj1cInNjb250ZW50XCJdW3NyYyo9XCJjZG5pbnN0YWdyYW1cIl0nLFxyXG4gICAgJ3NlY3Rpb24gbWFpbiBpbWdbc3JjKj1cInNjb250ZW50XCJdJyxcclxuICAgICdhcnRpY2xlIGhlYWRlciBpbWdbc3JjKj1cInNjb250ZW50XCJdJyxcclxuICBdXHJcbiAgZm9yIChjb25zdCBzZWwgb2YgYXZhdGFyU2VsZWN0b3JzKSB7XHJcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsKVxyXG4gICAgaWYgKGVsKSB7XHJcbiAgICAgIGNvbnN0IHNyYyA9IHNlbCA9PT0gJ21ldGFbcHJvcGVydHk9XCJvZzppbWFnZVwiXSdcclxuICAgICAgICA/IChlbCBhcyBIVE1MTWV0YUVsZW1lbnQpLmNvbnRlbnRcclxuICAgICAgICA6IChlbCBhcyBIVE1MSW1hZ2VFbGVtZW50KS5zcmNcclxuICAgICAgaWYgKHNyYyAmJiBzcmMuc3RhcnRzV2l0aCgnaHR0cCcpKSB7XHJcbiAgICAgICAgaW5mby5hdmF0YXJVcmwgPSBzcmNcclxuICAgICAgICBicmVha1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gaW5mb1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUNvdW50KHN0cjogc3RyaW5nKTogbnVtYmVyIHtcclxuICByZXR1cm4gcGFyc2VJbnQoc3RyLnJlcGxhY2UoL1ssLl0vZywgJycpKSB8fCAwXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1JlZWxzUGFnZSgpOiBib29sZWFuIHtcclxuICByZXR1cm4gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lLmluY2x1ZGVzKCcvcmVlbHMvJylcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvZmlsZVBhZ2UoKTogYm9vbGVhbiB7XHJcbiAgY29uc3QgcGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbilcclxuICBpZiAocGFydHMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2VcclxuICBjb25zdCBmaXJzdCA9IHBhcnRzWzBdXHJcbiAgaWYgKGZpcnN0ID09PSAnZXhwbG9yZScgfHwgZmlyc3QgPT09ICdyZWVsJyB8fCBmaXJzdCA9PT0gJ3AnIHx8IGZpcnN0ID09PSAnc3RvcmllcycgfHwgZmlyc3QgPT09ICdkaXJlY3QnKSByZXR1cm4gZmFsc2VcclxuICByZXR1cm4gcGFydHMubGVuZ3RoIDw9IDJcclxufVxyXG4iLCJleHBvcnQgaW50ZXJmYWNlIFBvc3RSZWVsc0NvbmZpZyB7XHJcbiAgYXBpVXJsOiBzdHJpbmdcclxuICBtaW5pb0VuZHBvaW50OiBzdHJpbmdcclxuICBtaW5pb0FjY2Vzc0tleTogc3RyaW5nXHJcbiAgbWluaW9TZWNyZXRLZXk6IHN0cmluZ1xyXG4gIG1pbmlvQnVja2V0OiBzdHJpbmdcclxuICBjb25jdXJyZW5jeTogbnVtYmVyXHJcbiAgc2Nyb2xsRGVsYXk6IG51bWJlclxyXG4gIG1heFNjcm9sbHM6IG51bWJlclxyXG4gIG1heERvd25sb2FkczogbnVtYmVyXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUHJvZmlsZUluZm8ge1xyXG4gIHVzZXJuYW1lOiBzdHJpbmdcclxuICBmdWxsTmFtZTogc3RyaW5nXHJcbiAgYXZhdGFyVXJsPzogc3RyaW5nXHJcbiAgcG9zdHNDb3VudD86IG51bWJlclxyXG4gIGZvbGxvd2Vyc0NvdW50PzogbnVtYmVyXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGVuZGluZ0Rvd25sb2FkIHtcclxuICBzaG9ydGNvZGVzOiBzdHJpbmdbXVxyXG4gIHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxyXG4gIG5pY2hlczogTmljaGVbXVxyXG4gIHByb2ZpbGVVcmw6IHN0cmluZ1xyXG4gIHByb2ZpbGU/OiBQcm9maWxlSW5mb1xyXG4gIHBsYXRmb3JtOiBQbGF0Zm9ybVxyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFJlZWxJbmZvIHtcclxuICBzaG9ydGNvZGU6IHN0cmluZ1xyXG4gIHZpZGVvVXJsOiBzdHJpbmdcclxuICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgUGxhdGZvcm0gPSAnSU5TVEFHUkFNJyB8ICdGQUNFQk9PSycgfCAnWU9VVFVCRSdcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRG93bmxvYWRUYXNrIHtcclxuICBpZDogc3RyaW5nXHJcbiAgc2hvcnRjb2RlOiBzdHJpbmdcclxuICB2aWRlb1VybDogc3RyaW5nXHJcbiAgbmljaGVJZDogc3RyaW5nXHJcbiAgcGxhdGZvcm06IFBsYXRmb3JtXHJcbiAgc3RhdHVzOiAncXVldWVkJyB8ICdkb3dubG9hZGluZycgfCAndXBsb2FkaW5nJyB8ICdjb21wbGV0ZWQnIHwgJ2Vycm9yJ1xyXG4gIHByb2dyZXNzOiBudW1iZXJcclxuICBlcnJvcj86IHN0cmluZ1xyXG4gIGZpbGVuYW1lPzogc3RyaW5nXHJcbiAgY3JlYXRlZEF0OiBudW1iZXJcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOaWNoZSB7XHJcbiAgaWQ6IHN0cmluZ1xyXG4gIG5vbWU6IHN0cmluZ1xyXG4gIGNvcjogc3RyaW5nIHwgbnVsbFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT05GSUc6IFBvc3RSZWVsc0NvbmZpZyA9IHtcclxuICBhcGlVcmw6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxyXG4gIG1pbmlvRW5kcG9pbnQ6ICdodHRwOi8vbG9jYWxob3N0OjkwMDAnLFxyXG4gIG1pbmlvQWNjZXNzS2V5OiAnbWluaW9hZG1pbicsXHJcbiAgbWluaW9TZWNyZXRLZXk6ICdtaW5pb2FkbWluJyxcclxuICBtaW5pb0J1Y2tldDogJ3Bvc3RyZWVscy1kb3dubG9hZHMnLFxyXG4gIGNvbmN1cnJlbmN5OiAzLFxyXG4gIHNjcm9sbERlbGF5OiAxNTAwLFxyXG4gIG1heFNjcm9sbHM6IDUwLFxyXG4gIG1heERvd25sb2FkczogMjAsXHJcbn1cclxuIiwiaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnXHJcbmltcG9ydCB7IGdldEFsbFJlZWxMaW5rcywgZXh0cmFjdFJlZWxzRnJvbVBhZ2UsIGV4dHJhY3RQcm9maWxlSW5mbywgaXNSZWVsc1BhZ2UsIGlzUHJvZmlsZVBhZ2UgfSBmcm9tICcuLi9zcmMvbGliL2luc3RhZ3JhbSdcclxuaW1wb3J0IHsgREVGQVVMVF9DT05GSUcgfSBmcm9tICcuLi9zcmMvbGliL3R5cGVzJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XHJcbiAgbWF0Y2hlczogWydodHRwczovL3d3dy5pbnN0YWdyYW0uY29tLyonXSxcclxuICBtYWluKCkge1xyXG4gICAgbGV0IGRvd25sb2FkQnV0dG9uOiBIVE1MRGl2RWxlbWVudCB8IG51bGwgPSBudWxsXHJcbiAgICBsZXQgaXNTY2FubmluZyA9IGZhbHNlXHJcblxyXG4gICAgZnVuY3Rpb24gaW5qZWN0VG9vbGJhcigpIHtcclxuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSByZXR1cm5cclxuICAgICAgaWYgKCFpc1JlZWxzUGFnZSgpICYmICFpc1Byb2ZpbGVQYWdlKCkpIHJldHVyblxyXG5cclxuICAgICAgZG93bmxvYWRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxyXG4gICAgICBkb3dubG9hZEJ1dHRvbi5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPGRpdiBzdHlsZT1cIlxyXG4gICAgICAgICAgcG9zaXRpb246Zml4ZWQ7Ym90dG9tOjI0cHg7cmlnaHQ6MjRweDt6LWluZGV4Ojk5OTk5O1xyXG4gICAgICAgICAgZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtnYXA6OHB4O1xyXG4gICAgICAgICAgZm9udC1mYW1pbHk6c2Fucy1zZXJpZjtcclxuICAgICAgICBcIj5cclxuICAgICAgICAgIDxidXR0b24gaWQ9XCJwci1zY2FuLWJ0blwiIHN0eWxlPVwiXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IzAwOTVmNjtjb2xvcjp3aGl0ZTtib3JkZXI6bm9uZTtcclxuICAgICAgICAgICAgcGFkZGluZzoxMnB4IDIwcHg7Ym9yZGVyLXJhZGl1czo4cHg7XHJcbiAgICAgICAgICAgIGZvbnQtc2l6ZToxNHB4O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlcjtcclxuICAgICAgICAgICAgYm94LXNoYWRvdzowIDRweCAxMnB4IHJnYmEoMCwxNDksMjQ2LDAuNCk7XHJcbiAgICAgICAgICAgIHRyYW5zaXRpb246dHJhbnNmb3JtIDAuMnM7XHJcbiAgICAgICAgICBcIj7wn5OlIEJhaXhhciBSZWVsczwvYnV0dG9uPlxyXG4gICAgICAgICAgPGRpdiBpZD1cInByLXN0YXR1c1wiIHN0eWxlPVwiXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IzFhMWEyZTtjb2xvcjojZTBlMGUwO2JvcmRlci1yYWRpdXM6OHB4O1xyXG4gICAgICAgICAgICBwYWRkaW5nOjhweCAxMnB4O2ZvbnQtc2l6ZToxMnB4O2Rpc3BsYXk6bm9uZTtcclxuICAgICAgICAgICAgbWF4LXdpZHRoOjI4MHB4O1xyXG4gICAgICAgICAgXCI+PC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIGBcclxuXHJcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG93bmxvYWRCdXR0b24pXHJcbiAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwci1zY2FuLWJ0bicpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHN0YXJ0U2NhbilcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjb2xsZWN0UmVlbHMoKTogeyBzaG9ydGNvZGVzOiBzdHJpbmdbXTsgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0ge1xyXG4gICAgICBjb25zdCByZWVscyA9IGV4dHJhY3RSZWVsc0Zyb21QYWdlKClcclxuICAgICAgY29uc3Qgc2hvcnRjb2Rlczogc3RyaW5nW10gPSBbXVxyXG4gICAgICBjb25zdCB2aWRlb1VybHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxyXG5cclxuICAgICAgZm9yIChjb25zdCByZWVsIG9mIHJlZWxzKSB7XHJcbiAgICAgICAgc2hvcnRjb2Rlcy5wdXNoKHJlZWwuc2hvcnRjb2RlKVxyXG4gICAgICAgIGlmIChyZWVsLnZpZGVvVXJsKSB7XHJcbiAgICAgICAgICB2aWRlb1VybHNbcmVlbC5zaG9ydGNvZGVdID0gcmVlbC52aWRlb1VybFxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHsgc2hvcnRjb2RlcywgdmlkZW9VcmxzIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBtZXJnZVJlZWxzKFxyXG4gICAgICBleGlzdGluZzogeyBzaG9ydGNvZGVzOiBTZXQ8c3RyaW5nPjsgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0sXHJcbiAgICAgIGluY29taW5nOiB7IHNob3J0Y29kZXM6IHN0cmluZ1tdOyB2aWRlb1VybHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfSxcclxuICAgICkge1xyXG4gICAgICBmb3IgKGNvbnN0IHNjIG9mIGluY29taW5nLnNob3J0Y29kZXMpIHtcclxuICAgICAgICBleGlzdGluZy5zaG9ydGNvZGVzLmFkZChzYylcclxuICAgICAgICBpZiAoaW5jb21pbmcudmlkZW9VcmxzW3NjXSkge1xyXG4gICAgICAgICAgZXhpc3RpbmcudmlkZW9VcmxzW3NjXSA9IGluY29taW5nLnZpZGVvVXJsc1tzY11cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBmdW5jdGlvbiByZWFkQ29uZmlnKCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0KCdwb3N0cmVlbHNDb25maWcnKVxyXG4gICAgICAgIHJldHVybiB7IC4uLkRFRkFVTFRfQ09ORklHLCAuLi5yZXN1bHQucG9zdHJlZWxzQ29uZmlnIH1cclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgcmV0dXJuIERFRkFVTFRfQ09ORklHXHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBmdW5jdGlvbiBzdGFydFNjYW4oKSB7XHJcbiAgICAgIGlmIChpc1NjYW5uaW5nKSByZXR1cm5cclxuICAgICAgaXNTY2FubmluZyA9IHRydWVcclxuXHJcbiAgICAgIGNvbnN0IHN0YXR1c0VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByLXN0YXR1cycpXHJcbiAgICAgIGlmICghc3RhdHVzRWwpIHJldHVyblxyXG4gICAgICBzdGF0dXNFbC5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJ1xyXG4gICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9ICfwn5SNIEluaWNpYW5kbyB2YXJyZWR1cmEuLi4nXHJcblxyXG4gICAgICBjb25zdCBjb25maWcgPSBhd2FpdCByZWFkQ29uZmlnKClcclxuXHJcbiAgICAgIGNvbnN0IHNob3J0Y29kZXMgPSBuZXcgU2V0PHN0cmluZz4oKVxyXG4gICAgICBjb25zdCB2aWRlb1VybHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxyXG5cclxuICAgICAgbWVyZ2VSZWVscyh7IHNob3J0Y29kZXMsIHZpZGVvVXJscyB9LCBjb2xsZWN0UmVlbHMoKSlcclxuICAgICAgc3RhdHVzRWwudGV4dENvbnRlbnQgPSBg8J+UjSBFbmNvbnRyYWRvcyAke3Nob3J0Y29kZXMuc2l6ZX0gdsOtZGVvcy4uLiBSb2xhbmRvIHDDoWdpbmFgXHJcblxyXG4gICAgICBsZXQgc2Nyb2xsQ291bnQgPSAwXHJcbiAgICAgIGNvbnN0IG5vTmV3TGltaXQgPSA1XHJcblxyXG4gICAgICB3aGlsZSAoc2hvcnRjb2Rlcy5zaXplIDwgY29uZmlnLm1heERvd25sb2FkcyAmJiBzY3JvbGxDb3VudCA8IGNvbmZpZy5tYXhTY3JvbGxzKSB7XHJcbiAgICAgICAgY29uc3QgYmVmb3JlID0gc2hvcnRjb2Rlcy5zaXplXHJcblxyXG4gICAgICAgIHdpbmRvdy5zY3JvbGxCeSgwLCAxNTAwKVxyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCBjb25maWcuc2Nyb2xsRGVsYXkpKVxyXG5cclxuICAgICAgICBtZXJnZVJlZWxzKHsgc2hvcnRjb2RlcywgdmlkZW9VcmxzIH0sIGNvbGxlY3RSZWVscygpKVxyXG5cclxuICAgICAgICBpZiAoc2hvcnRjb2Rlcy5zaXplID09PSBiZWZvcmUpIHtcclxuICAgICAgICAgIGlmICgrK3Njcm9sbENvdW50ID49IG5vTmV3TGltaXQpIGJyZWFrXHJcbiAgICAgICAgICBjb250aW51ZVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc3RhdHVzRWwudGV4dENvbnRlbnQgPSBg8J+UjSBFbmNvbnRyYWRvcyAke3Nob3J0Y29kZXMuc2l6ZX0gdsOtZGVvcy4uLiBSb2xhbmRvICgke3Njcm9sbENvdW50ICsgMX0vJHtjb25maWcubWF4U2Nyb2xsc30pYFxyXG4gICAgICAgIHNjcm9sbENvdW50ID0gMCAvLyByZXNldCBuby1uZXcgY291bnRlciB3aGVuIHdlIGZpbmQgbmV3IG9uZXNcclxuICAgICAgfVxyXG5cclxuICAgICAgc3RhdHVzRWwudGV4dENvbnRlbnQgPSBg4pyFICR7c2hvcnRjb2Rlcy5zaXplfSB2w61kZW9zIGVuY29udHJhZG9zIWBcclxuXHJcbiAgICAgIC8vIENhcHR1cmUgcHJvZmlsZSBpbmZvXHJcbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBleHRyYWN0UHJvZmlsZUluZm8oKVxyXG5cclxuICAgICAgbGV0IG5pY2hlczogQXJyYXk8eyBpZDogc3RyaW5nOyBub21lOiBzdHJpbmcgfT4gPSBbXVxyXG5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS9uaWNob3MnLCB7XHJcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgICAgaGVhZGVyczogeyAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cclxuICAgICAgICB9KVxyXG4gICAgICAgIGlmIChyZXMub2spIHtcclxuICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXMuanNvbigpXHJcbiAgICAgICAgICBpZiAoZGF0YS5zdWNjZXNzICYmIGRhdGEuZGF0YSkge1xyXG4gICAgICAgICAgICBuaWNoZXMgPSBkYXRhLmRhdGFcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUud2FybignW0NvbnRlbnRdIEF2aXNvIGFvIGNhcnJlZ2FyIG5pY2hvcyAoc2Vyw6EgcmVjYXJyZWdhZG8gbm8gcG9wdXApOicsIGVycilcclxuICAgICAgfVxyXG5cclxuICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgdHlwZTogJ0RPV05MT0FEX1JFRUxTJyxcclxuICAgICAgICAgIHBheWxvYWQ6IHtcclxuICAgICAgICAgICAgc2hvcnRjb2RlczogQXJyYXkuZnJvbShzaG9ydGNvZGVzKSxcclxuICAgICAgICAgICAgdmlkZW9VcmxzLFxyXG4gICAgICAgICAgICBwcm9maWxlVXJsOiB3aW5kb3cubG9jYXRpb24uaHJlZixcclxuICAgICAgICAgICAgbmljaGVzLFxyXG4gICAgICAgICAgICBwcm9maWxlLFxyXG4gICAgICAgICAgICBwbGF0Zm9ybTogJ0lOU1RBR1JBTScsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgKHJlc3BvbnNlOiBhbnkpID0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbQ29udGVudF0gUmVzcG9zdGEgZG8gYmFja2dyb3VuZDonLCByZXNwb25zZSlcclxuICAgICAgICAgIGlmIChyZXNwb25zZT8uc3VjY2Vzcykge1xyXG4gICAgICAgICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9IGDinIUgJHtzaG9ydGNvZGVzLnNpemV9IHbDrWRlb3MgZW5jb250cmFkb3MhIFZlcmlmaXF1ZSBvIHBvcHVwIGRhIGV4dGVuc8Ojby5gXHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9IGDinYwgRXJybyBhbyBlbnZpYXIgcGFyYSBkb3dubG9hZGBcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIClcclxuXHJcbiAgICAgIGlzU2Nhbm5pbmcgPSBmYWxzZVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHRyeUluamVjdCgpIHtcclxuICAgICAgaWYgKGlzUmVlbHNQYWdlKCkgfHwgaXNQcm9maWxlUGFnZSgpKSB7XHJcbiAgICAgICAgaW5qZWN0VG9vbGJhcigpXHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0cnlJbmplY3QoKVxyXG5cclxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xyXG4gICAgICBpZiAoIWRvd25sb2FkQnV0dG9uIHx8ICFkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRvd25sb2FkQnV0dG9uKSkge1xyXG4gICAgICAgIGRvd25sb2FkQnV0dG9uID0gbnVsbFxyXG4gICAgICAgIHRyeUluamVjdCgpXHJcbiAgICAgIH1cclxuICAgIH0pXHJcbiAgICBvYnNlcnZlci5vYnNlcnZlKGRvY3VtZW50LmJvZHksIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pXHJcblxyXG4gICAgbGV0IGxhc3RVcmwgPSBsb2NhdGlvbi5ocmVmXHJcbiAgICBjb25zdCB1cmxPYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcclxuICAgICAgaWYgKGxvY2F0aW9uLmhyZWYgIT09IGxhc3RVcmwpIHtcclxuICAgICAgICBsYXN0VXJsID0gbG9jYXRpb24uaHJlZlxyXG4gICAgICAgIHNldFRpbWVvdXQodHJ5SW5qZWN0LCAxMDAwKVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gICAgdXJsT2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KVxyXG4gIH0sXHJcbn0pXHJcbiIsIi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLnRzXG5mdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcblx0aWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuXHRpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIG1ldGhvZChgW3d4dF0gJHthcmdzLnNoaWZ0KCl9YCwgLi4uYXJncyk7XG5cdGVsc2UgbWV0aG9kKFwiW3d4dF1cIiwgLi4uYXJncyk7XG59XG4vKiogV3JhcHBlciBhcm91bmQgYGNvbnNvbGVgIHdpdGggYSBcIlt3eHRdXCIgcHJlZml4ICovXG5jb25zdCBsb2dnZXIgPSB7XG5cdGRlYnVnOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5kZWJ1ZywgLi4uYXJncyksXG5cdGxvZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUubG9nLCAuLi5hcmdzKSxcblx0d2FybjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUud2FybiwgLi4uYXJncyksXG5cdGVycm9yOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5lcnJvciwgLi4uYXJncylcbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGxvZ2dlciB9O1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy50c1xudmFyIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgPSBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuXHRzdGF0aWMgRVZFTlRfTkFNRSA9IGdldFVuaXF1ZUV2ZW50TmFtZShcInd4dDpsb2NhdGlvbmNoYW5nZVwiKTtcblx0Y29uc3RydWN0b3IobmV3VXJsLCBvbGRVcmwpIHtcblx0XHRzdXBlcihXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LkVWRU5UX05BTUUsIHt9KTtcblx0XHR0aGlzLm5ld1VybCA9IG5ld1VybDtcblx0XHR0aGlzLm9sZFVybCA9IG9sZFVybDtcblx0fVxufTtcbi8qKlxuKiBSZXR1cm5zIGFuIGV2ZW50IG5hbWUgdW5pcXVlIHRvIHRoZSBleHRlbnNpb24gYW5kIGNvbnRlbnQgc2NyaXB0IHRoYXQnc1xuKiBydW5uaW5nLlxuKi9cbmZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcblx0cmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50LCBnZXRVbmlxdWVFdmVudE5hbWUgfTtcbiIsImltcG9ydCB7IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tIFwiLi9jdXN0b20tZXZlbnRzLm1qc1wiO1xuLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLnRzXG5jb25zdCBzdXBwb3J0c05hdmlnYXRpb25BcGkgPSB0eXBlb2YgZ2xvYmFsVGhpcy5uYXZpZ2F0aW9uPy5hZGRFdmVudExpc3RlbmVyID09PSBcImZ1bmN0aW9uXCI7XG4vKipcbiogQ3JlYXRlIGEgdXRpbCB0aGF0IHdhdGNoZXMgZm9yIFVSTCBjaGFuZ2VzLCBkaXNwYXRjaGluZyB0aGUgY3VzdG9tIGV2ZW50IHdoZW5cbiogZGV0ZWN0ZWQuIFN0b3BzIHdhdGNoaW5nIHdoZW4gY29udGVudCBzY3JpcHQgaXMgaW52YWxpZGF0ZWQuIFVzZXMgTmF2aWdhdGlvblxuKiBBUEkgd2hlbiBhdmFpbGFibGUsIG90aGVyd2lzZSBmYWxscyBiYWNrIHRvIHBvbGxpbmcuXG4qL1xuZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuXHRsZXQgbGFzdFVybDtcblx0bGV0IHdhdGNoaW5nID0gZmFsc2U7XG5cdHJldHVybiB7IHJ1bigpIHtcblx0XHRpZiAod2F0Y2hpbmcpIHJldHVybjtcblx0XHR3YXRjaGluZyA9IHRydWU7XG5cdFx0bGFzdFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0aWYgKHN1cHBvcnRzTmF2aWdhdGlvbkFwaSkgZ2xvYmFsVGhpcy5uYXZpZ2F0aW9uLmFkZEV2ZW50TGlzdGVuZXIoXCJuYXZpZ2F0ZVwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwoZXZlbnQuZGVzdGluYXRpb24udXJsKTtcblx0XHRcdGlmIChuZXdVcmwuaHJlZiA9PT0gbGFzdFVybC5ocmVmKSByZXR1cm47XG5cdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdGxhc3RVcmwgPSBuZXdVcmw7XG5cdFx0fSwgeyBzaWduYWw6IGN0eC5zaWduYWwgfSk7XG5cdFx0ZWxzZSBjdHguc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3VXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcblx0XHRcdGlmIChuZXdVcmwuaHJlZiAhPT0gbGFzdFVybC5ocmVmKSB7XG5cdFx0XHRcdHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50KG5ld1VybCwgbGFzdFVybCkpO1xuXHRcdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdFx0fVxuXHRcdH0sIDFlMyk7XG5cdH0gfTtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH07XG4iLCJpbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2dnZXIubWpzXCI7XG5pbXBvcnQgeyBnZXRVbmlxdWVFdmVudE5hbWUgfSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC50c1xuLyoqXG4qIEltcGxlbWVudHNcbiogW2BBYm9ydENvbnRyb2xsZXJgXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQWJvcnRDb250cm9sbGVyKS5cbiogVXNlZCB0byBkZXRlY3QgYW5kIHN0b3AgY29udGVudCBzY3JpcHQgY29kZSB3aGVuIHRoZSBzY3JpcHQgaXMgaW52YWxpZGF0ZWQuXG4qXG4qIEl0IGFsc28gcHJvdmlkZXMgc2V2ZXJhbCB1dGlsaXRpZXMgbGlrZSBgY3R4LnNldFRpbWVvdXRgIGFuZFxuKiBgY3R4LnNldEludGVydmFsYCB0aGF0IHNob3VsZCBiZSB1c2VkIGluIGNvbnRlbnQgc2NyaXB0cyBpbnN0ZWFkIG9mXG4qIGB3aW5kb3cuc2V0VGltZW91dGAgb3IgYHdpbmRvdy5zZXRJbnRlcnZhbGAuXG4qXG4qIFRvIGNyZWF0ZSBjb250ZXh0IGZvciB0ZXN0aW5nLCB5b3UgY2FuIHVzZSB0aGUgY2xhc3MncyBjb25zdHJ1Y3RvcjpcbipcbiogYGBgdHNcbiogaW1wb3J0IHsgQ29udGVudFNjcmlwdENvbnRleHQgfSBmcm9tICd3eHQvdXRpbHMvY29udGVudC1zY3JpcHRzLWNvbnRleHQnO1xuKlxuKiB0ZXN0KCdzdG9yYWdlIGxpc3RlbmVyIHNob3VsZCBiZSByZW1vdmVkIHdoZW4gY29udGV4dCBpcyBpbnZhbGlkYXRlZCcsICgpID0+IHtcbiogICBjb25zdCBjdHggPSBuZXcgQ29udGVudFNjcmlwdENvbnRleHQoJ3Rlc3QnKTtcbiogICBjb25zdCBpdGVtID0gc3RvcmFnZS5kZWZpbmVJdGVtKCdsb2NhbDpjb3VudCcsIHsgZGVmYXVsdFZhbHVlOiAwIH0pO1xuKiAgIGNvbnN0IHdhdGNoZXIgPSB2aS5mbigpO1xuKlxuKiAgIGNvbnN0IHVud2F0Y2ggPSBpdGVtLndhdGNoKHdhdGNoZXIpO1xuKiAgIGN0eC5vbkludmFsaWRhdGVkKHVud2F0Y2gpOyAvLyBMaXN0ZW4gZm9yIGludmFsaWRhdGUgaGVyZVxuKlxuKiAgIGF3YWl0IGl0ZW0uc2V0VmFsdWUoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRUaW1lcygxKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFdpdGgoMSwgMCk7XG4qXG4qICAgY3R4Lm5vdGlmeUludmFsaWRhdGVkKCk7IC8vIFVzZSB0aGlzIGZ1bmN0aW9uIHRvIGludmFsaWRhdGUgdGhlIGNvbnRleHRcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDIpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qIH0pO1xuKiBgYGBcbiovXG52YXIgQ29udGVudFNjcmlwdENvbnRleHQgPSBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG5cdHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiKTtcblx0aWQ7XG5cdGFib3J0Q29udHJvbGxlcjtcblx0bG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuXHRjb25zdHJ1Y3Rvcihjb250ZW50U2NyaXB0TmFtZSwgb3B0aW9ucykge1xuXHRcdHRoaXMuY29udGVudFNjcmlwdE5hbWUgPSBjb250ZW50U2NyaXB0TmFtZTtcblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdHRoaXMuaWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyKTtcblx0XHR0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcblx0XHR0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG5cdFx0dGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoKTtcblx0fVxuXHRnZXQgc2lnbmFsKCkge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG5cdH1cblx0YWJvcnQocmVhc29uKSB7XG5cdFx0cmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG5cdH1cblx0Z2V0IGlzSW52YWxpZCgpIHtcblx0XHRpZiAoYnJvd3Nlci5ydW50aW1lPy5pZCA9PSBudWxsKSB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG5cdFx0cmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG5cdH1cblx0Z2V0IGlzVmFsaWQoKSB7XG5cdFx0cmV0dXJuICF0aGlzLmlzSW52YWxpZDtcblx0fVxuXHQvKipcblx0KiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXNcblx0KiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIEBleGFtcGxlXG5cdCogICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKGNiKTtcblx0KiAgIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG5cdCogICAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuXHQqICAgfSk7XG5cdCogICAvLyAuLi5cblx0KiAgIHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIoKTtcblx0KlxuXHQqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cblx0Ki9cblx0b25JbnZhbGlkYXRlZChjYikge1xuXHRcdHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG5cdFx0cmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG5cdH1cblx0LyoqXG5cdCogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb25cblx0KiB0aGF0IHNob3VsZG4ndCBydW4gYWZ0ZXIgdGhlIGNvbnRleHQgaXMgZXhwaXJlZC5cblx0KlxuXHQqIEBleGFtcGxlXG5cdCogICBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuXHQqICAgICBpZiAoY3R4LmlzSW52YWxpZCkgcmV0dXJuIGN0eC5ibG9jaygpO1xuXHQqXG5cdCogICAgIC8vIC4uLlxuXHQqICAgfTtcblx0Ki9cblx0YmxvY2soKSB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHt9KTtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldEludGVydmFsYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2xlYXJzIHRoZSBpbnRlcnZhbFxuXHQqIHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBJbnRlcnZhbHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjbGVhckludGVydmFsYCBmdW5jdGlvbi5cblx0Ki9cblx0c2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuXHRcdH0sIHRpbWVvdXQpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cblx0Ki9cblx0c2V0VGltZW91dChoYW5kbGVyLCB0aW1lb3V0KSB7XG5cdFx0Y29uc3QgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJUaW1lb3V0KGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2Vsc1xuXHQqIHRoZSByZXF1ZXN0IHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgXG5cdCogZnVuY3Rpb24uXG5cdCovXG5cdHJlcXVlc3RBbmltYXRpb25GcmFtZShjYWxsYmFjaykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCguLi5hcmdzKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsQW5pbWF0aW9uRnJhbWUoaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGVcblx0KiByZXF1ZXN0IHdoZW4gaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0SWRsZUNhbGxiYWNrKGNhbGxiYWNrLCBvcHRpb25zKSB7XG5cdFx0Y29uc3QgaWQgPSByZXF1ZXN0SWRsZUNhbGxiYWNrKCguLi5hcmdzKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuc2lnbmFsLmFib3J0ZWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuXHRcdH0sIG9wdGlvbnMpO1xuXHRcdHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxJZGxlQ2FsbGJhY2soaWQpKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblx0YWRkRXZlbnRMaXN0ZW5lcih0YXJnZXQsIHR5cGUsIGhhbmRsZXIsIG9wdGlvbnMpIHtcblx0XHRpZiAodHlwZSA9PT0gXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIikge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgdGhpcy5sb2NhdGlvbldhdGNoZXIucnVuKCk7XG5cdFx0fVxuXHRcdHRhcmdldC5hZGRFdmVudExpc3RlbmVyPy4odHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsIGhhbmRsZXIsIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRzaWduYWw6IHRoaXMuc2lnbmFsXG5cdFx0fSk7XG5cdH1cblx0LyoqXG5cdCogQGludGVybmFsXG5cdCogQWJvcnQgdGhlIGFib3J0IGNvbnRyb2xsZXIgYW5kIGV4ZWN1dGUgYWxsIGBvbkludmFsaWRhdGVkYCBsaXN0ZW5lcnMuXG5cdCovXG5cdG5vdGlmeUludmFsaWRhdGVkKCkge1xuXHRcdHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuXHRcdGxvZ2dlci5kZWJ1ZyhgQ29udGVudCBzY3JpcHQgXCIke3RoaXMuY29udGVudFNjcmlwdE5hbWV9XCIgY29udGV4dCBpbnZhbGlkYXRlZGApO1xuXHR9XG5cdHN0b3BPbGRTY3JpcHRzKCkge1xuXHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEN1c3RvbUV2ZW50KENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSwgeyBkZXRhaWw6IHtcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSB9KSk7XG5cdFx0aWYgKCF0aGlzLm9wdGlvbnM/Lm5vU2NyaXB0U3RhcnRlZFBvc3RNZXNzYWdlKSB3aW5kb3cucG9zdE1lc3NhZ2Uoe1xuXHRcdFx0dHlwZTogQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLFxuXHRcdFx0Y29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG5cdFx0XHRtZXNzYWdlSWQ6IHRoaXMuaWRcblx0XHR9LCBcIipcIik7XG5cdH1cblx0dmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG5cdFx0Y29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRldGFpbD8uY29udGVudFNjcmlwdE5hbWUgPT09IHRoaXMuY29udGVudFNjcmlwdE5hbWU7XG5cdFx0Y29uc3QgaXNGcm9tU2VsZiA9IGV2ZW50LmRldGFpbD8ubWVzc2FnZUlkID09PSB0aGlzLmlkO1xuXHRcdHJldHVybiBpc1NhbWVDb250ZW50U2NyaXB0ICYmICFpc0Zyb21TZWxmO1xuXHR9XG5cdGxpc3RlbkZvck5ld2VyU2NyaXB0cygpIHtcblx0XHRjb25zdCBjYiA9IChldmVudCkgPT4ge1xuXHRcdFx0aWYgKCEoZXZlbnQgaW5zdGFuY2VvZiBDdXN0b21FdmVudCkgfHwgIXRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkgcmV0dXJuO1xuXHRcdFx0dGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdH07XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIGNiKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIGNiKSk7XG5cdH1cbn07XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNCw1LDYsNyw4LDldLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLG9CQUFvQixZQUFZO0VBQ3hDLE9BQU87Q0FDUjs7O0NDREEsU0FBZ0IsdUJBQW1DO0VBQ2pELE1BQU0sUUFBb0IsQ0FBQztFQUMzQixNQUFNLHVCQUFPLElBQUksSUFBWTtFQUk3QixTQUZ1QixpQkFBaUIscUJBRXhDLENBQUEsQ0FBTSxTQUFRLFNBQVE7R0FDcEIsTUFBTSxPQUFPLEtBQUssYUFBYSxNQUFNO0dBQ3JDLElBQUksQ0FBQyxNQUFNO0dBRVgsTUFBTSxRQUFRLEtBQUssTUFBTSxrQkFBa0I7R0FDM0MsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLE1BQU0sRUFBRSxHQUFHO0dBQ2xDLEtBQUssSUFBSSxNQUFNLEVBQUU7R0FFakIsTUFBTSxZQUFZLE1BQU07R0FFeEIsSUFBSSxXQUFXO0dBQ2YsSUFBSTtHQUVKLElBQUksVUFBMEI7R0FD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