var content = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/define-content-script.mjs
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
		return `${browser?.runtime?.id}:content:${eventName}`;
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
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?/home/gosantos/projects/postreels-v2/apps/extension/entrypoints/content.ts
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsIm5hbWVzIjpbInByaW50IiwibG9nZ2VyIiwiYnJvd3NlciJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC4xOS40M19lc2xpbnRAOC41Ny4xX2ppdGlAMi43LjBfcm9sbGRvd25AMS4xLjUvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9zcmMvbGliL2luc3RhZ3JhbS50cyIsIi4uLy4uLy4uL3NyYy9saWIvdHlwZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLjE5LjQzX2VzbGludEA4LjU3LjFfaml0aUAyLjcuMF9yb2xsZG93bkAxLjEuNS9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4yN19AdHlwZXMrbm9kZUAyMC4xOS40M19lc2xpbnRAOC41Ny4xX2ppdGlAMi43LjBfcm9sbGRvd25AMS4xLjUvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjI3X0B0eXBlcytub2RlQDIwLjE5LjQzX2VzbGludEA4LjU3LjFfaml0aUAyLjcuMF9yb2xsZG93bkAxLjEuNS9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCJpbXBvcnQgdHlwZSB7IFJlZWxJbmZvIH0gZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RSZWVsc0Zyb21QYWdlKCk6IFJlZWxJbmZvW10ge1xuICBjb25zdCByZWVsczogUmVlbEluZm9bXSA9IFtdXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKVxuXG4gIGNvbnN0IGxpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYVtocmVmKj1cIi9yZWVsL1wiXScpXG5cbiAgbGlua3MuZm9yRWFjaChsaW5rID0+IHtcbiAgICBjb25zdCBocmVmID0gbGluay5nZXRBdHRyaWJ1dGUoJ2hyZWYnKVxuICAgIGlmICghaHJlZikgcmV0dXJuXG5cbiAgICBjb25zdCBtYXRjaCA9IGhyZWYubWF0Y2goL1xcL3JlZWxcXC8oW14vP10rKS8pXG4gICAgaWYgKCFtYXRjaCB8fCBzZWVuLmhhcyhtYXRjaFsxXSkpIHJldHVyblxuICAgIHNlZW4uYWRkKG1hdGNoWzFdKVxuXG4gICAgY29uc3Qgc2hvcnRjb2RlID0gbWF0Y2hbMV1cblxuICAgIGxldCB2aWRlb1VybCA9ICcnXG4gICAgbGV0IHRodW1ibmFpbFVybDogc3RyaW5nIHwgdW5kZWZpbmVkXG5cbiAgICBsZXQgY3VycmVudDogRWxlbWVudCB8IG51bGwgPSBsaW5rXG4gICAgd2hpbGUgKGN1cnJlbnQgJiYgIXZpZGVvVXJsKSB7XG4gICAgICBjb25zdCB2aWRlbyA9IGN1cnJlbnQucXVlcnlTZWxlY3RvcigndmlkZW8nKVxuICAgICAgaWYgKHZpZGVvKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IHZpZGVvLnF1ZXJ5U2VsZWN0b3IoJ3NvdXJjZVt0eXBlPVwidmlkZW8vbXA0XCJdJylcbiAgICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICAgIHZpZGVvVXJsID0gc291cmNlLmdldEF0dHJpYnV0ZSgnc3JjJykgfHwgJydcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZpZGVvVXJsICYmIHZpZGVvLnNyYykge1xuICAgICAgICAgIHZpZGVvVXJsID0gdmlkZW8uc3JjXG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF2aWRlb1VybCkge1xuICAgICAgICAgIGNvbnN0IGRhdGFTcmMgPSB2aWRlby5nZXRBdHRyaWJ1dGUoJ2RhdGEtc3JjJylcbiAgICAgICAgICBpZiAoZGF0YVNyYykgdmlkZW9VcmwgPSBkYXRhU3JjXG4gICAgICAgIH1cbiAgICAgICAgdGh1bWJuYWlsVXJsID0gdmlkZW8uZ2V0QXR0cmlidXRlKCdwb3N0ZXInKSB8fCB1bmRlZmluZWRcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGltZyA9IGN1cnJlbnQucXVlcnlTZWxlY3RvcignaW1nW3NyYyo9XCJjZG5pbnN0YWdyYW1cIl0nKVxuICAgICAgaWYgKGltZyAmJiAhdGh1bWJuYWlsVXJsKSB7XG4gICAgICAgIHRodW1ibmFpbFVybCA9IGltZy5nZXRBdHRyaWJ1dGUoJ3NyYycpIHx8IHVuZGVmaW5lZFxuICAgICAgfVxuICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50RWxlbWVudFxuICAgIH1cblxuICAgIHJlZWxzLnB1c2goe1xuICAgICAgc2hvcnRjb2RlLFxuICAgICAgdmlkZW9VcmwsXG4gICAgICB0aHVtYm5haWxVcmwsXG4gICAgfSlcbiAgfSlcblxuICByZXR1cm4gcmVlbHNcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEFsbFJlZWxMaW5rcygpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGxpbmtzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnYVtocmVmKj1cIi9yZWVsL1wiXScpXG4gIGNvbnN0IHNob3J0Y29kZXMgPSBuZXcgU2V0PHN0cmluZz4oKVxuICBsaW5rcy5mb3JFYWNoKGxpbmsgPT4ge1xuICAgIGNvbnN0IGhyZWYgPSBsaW5rLmdldEF0dHJpYnV0ZSgnaHJlZicpXG4gICAgaWYgKCFocmVmKSByZXR1cm5cbiAgICBjb25zdCBtYXRjaCA9IGhyZWYubWF0Y2goL1xcL3JlZWxcXC8oW14vP10rKS8pXG4gICAgaWYgKG1hdGNoKSBzaG9ydGNvZGVzLmFkZChtYXRjaFsxXSlcbiAgfSlcbiAgcmV0dXJuIEFycmF5LmZyb20oc2hvcnRjb2Rlcylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RQcm9maWxlSW5mbygpIHtcbiAgY29uc3QgaW5mbyA9IHsgdXNlcm5hbWU6ICcnLCBmdWxsTmFtZTogJycsIGF2YXRhclVybDogJycsIHBvc3RzQ291bnQ6IDAsIGZvbGxvd2Vyc0NvdW50OiAwIH1cblxuICAvLyB1c2VybmFtZSBmcm9tIFVSTFxuICBjb25zdCBwYXRoUGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbilcbiAgaWYgKHBhdGhQYXJ0cy5sZW5ndGggPiAwKSBpbmZvLnVzZXJuYW1lID0gcGF0aFBhcnRzWzBdXG5cbiAgLy8gVHJ5IEpTT04tTEQgKHN0cnVjdHVyZWQgZGF0YSBpbmplY3RlZCBieSBJbnN0YWdyYW0pXG4gIGNvbnN0IGxkU2NyaXB0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcignc2NyaXB0W3R5cGU9XCJhcHBsaWNhdGlvbi9sZCtqc29uXCJdJylcbiAgaWYgKGxkU2NyaXB0KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGxkID0gSlNPTi5wYXJzZShsZFNjcmlwdC50ZXh0Q29udGVudCB8fCAne30nKVxuICAgICAgaWYgKGxkLm5hbWUpIGluZm8uZnVsbE5hbWUgPSBsZC5uYW1lXG4gICAgICBpZiAobGQudXJsKSBpbmZvLnVzZXJuYW1lID0gbGQudXJsLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pLnBvcCgpIHx8IGluZm8udXNlcm5hbWVcbiAgICAgIGlmIChsZC5kZXNjcmlwdGlvbikge1xuICAgICAgICBjb25zdCBwb3N0TWF0Y2ggPSBsZC5kZXNjcmlwdGlvbi5tYXRjaCgvKFtcXGQsLl0rKVxccypbUHBddWJsaWNhw6cvKVxuICAgICAgICBjb25zdCBmb2xsb3dlck1hdGNoID0gbGQuZGVzY3JpcHRpb24ubWF0Y2goLyhbXFxkLC5dKylcXHMqW1NzXWVndWlkb3IvKVxuICAgICAgICBpZiAocG9zdE1hdGNoKSBpbmZvLnBvc3RzQ291bnQgPSBwYXJzZUNvdW50KHBvc3RNYXRjaFsxXSlcbiAgICAgICAgaWYgKGZvbGxvd2VyTWF0Y2gpIGluZm8uZm9sbG93ZXJzQ291bnQgPSBwYXJzZUNvdW50KGZvbGxvd2VyTWF0Y2hbMV0pXG4gICAgICB9XG4gICAgfSBjYXRjaCB7fVxuICB9XG5cbiAgLy8gRmFsbGJhY2s6IHNjcmFwZSBtZXRhIHRhZ3MgYW5kIHZpc2libGUgZWxlbWVudHNcbiAgaWYgKCFpbmZvLmZ1bGxOYW1lKSB7XG4gICAgY29uc3QgbWV0YVRpdGxlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWV0YVtwcm9wZXJ0eT1cIm9nOnRpdGxlXCJdJylcbiAgICBpZiAobWV0YVRpdGxlKSBpbmZvLmZ1bGxOYW1lID0gbWV0YVRpdGxlLmdldEF0dHJpYnV0ZSgnY29udGVudCcpPy5zcGxpdCgnKCcpWzBdPy50cmltKCkgfHwgJydcbiAgfVxuXG4gIC8vIEF2YXRhcjogdHJ5IG11bHRpcGxlIHNlbGVjdG9ycyB1c2VkIGJ5IEluc3RhZ3JhbSdzIGN1cnJlbnQgRE9NXG4gIGNvbnN0IGF2YXRhclNlbGVjdG9ycyA9IFtcbiAgICAnbWV0YVtwcm9wZXJ0eT1cIm9nOmltYWdlXCJdJyxcbiAgICAnaW1nW2FsdCo9XCInICsgaW5mby51c2VybmFtZSArICdcIl0nLFxuICAgICdpbWdbZGF0YS10ZXN0aWQ9XCJ1c2VyLWF2YXRhclwiXScsXG4gICAgJ2hlYWRlciBpbWdbc3JjKj1cInNjb250ZW50XCJdJyxcbiAgICAnaW1nW3NyYyo9XCJzY29udGVudFwiXVtzcmMqPVwiY2RuaW5zdGFncmFtXCJdJyxcbiAgICAnc2VjdGlvbiBtYWluIGltZ1tzcmMqPVwic2NvbnRlbnRcIl0nLFxuICAgICdhcnRpY2xlIGhlYWRlciBpbWdbc3JjKj1cInNjb250ZW50XCJdJyxcbiAgXVxuICBmb3IgKGNvbnN0IHNlbCBvZiBhdmF0YXJTZWxlY3RvcnMpIHtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsKVxuICAgIGlmIChlbCkge1xuICAgICAgY29uc3Qgc3JjID0gc2VsID09PSAnbWV0YVtwcm9wZXJ0eT1cIm9nOmltYWdlXCJdJ1xuICAgICAgICA/IChlbCBhcyBIVE1MTWV0YUVsZW1lbnQpLmNvbnRlbnRcbiAgICAgICAgOiAoZWwgYXMgSFRNTEltYWdlRWxlbWVudCkuc3JjXG4gICAgICBpZiAoc3JjICYmIHNyYy5zdGFydHNXaXRoKCdodHRwJykpIHtcbiAgICAgICAgaW5mby5hdmF0YXJVcmwgPSBzcmNcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gaW5mb1xufVxuXG5mdW5jdGlvbiBwYXJzZUNvdW50KHN0cjogc3RyaW5nKTogbnVtYmVyIHtcbiAgcmV0dXJuIHBhcnNlSW50KHN0ci5yZXBsYWNlKC9bLC5dL2csICcnKSkgfHwgMFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSZWVsc1BhZ2UoKTogYm9vbGVhbiB7XG4gIHJldHVybiB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuaW5jbHVkZXMoJy9yZWVscy8nKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9maWxlUGFnZSgpOiBib29sZWFuIHtcbiAgY29uc3QgcGFydHMgPSB3aW5kb3cubG9jYXRpb24ucGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbilcbiAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlXG4gIGNvbnN0IGZpcnN0ID0gcGFydHNbMF1cbiAgaWYgKGZpcnN0ID09PSAnZXhwbG9yZScgfHwgZmlyc3QgPT09ICdyZWVsJyB8fCBmaXJzdCA9PT0gJ3AnIHx8IGZpcnN0ID09PSAnc3RvcmllcycgfHwgZmlyc3QgPT09ICdkaXJlY3QnKSByZXR1cm4gZmFsc2VcbiAgcmV0dXJuIHBhcnRzLmxlbmd0aCA8PSAyXG59XG4iLCJleHBvcnQgaW50ZXJmYWNlIFBvc3RSZWVsc0NvbmZpZyB7XG4gIGFwaVVybDogc3RyaW5nXG4gIG1pbmlvRW5kcG9pbnQ6IHN0cmluZ1xuICBtaW5pb0FjY2Vzc0tleTogc3RyaW5nXG4gIG1pbmlvU2VjcmV0S2V5OiBzdHJpbmdcbiAgbWluaW9CdWNrZXQ6IHN0cmluZ1xuICBjb25jdXJyZW5jeTogbnVtYmVyXG4gIHNjcm9sbERlbGF5OiBudW1iZXJcbiAgbWF4U2Nyb2xsczogbnVtYmVyXG4gIG1heERvd25sb2FkczogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvZmlsZUluZm8ge1xuICB1c2VybmFtZTogc3RyaW5nXG4gIGZ1bGxOYW1lOiBzdHJpbmdcbiAgYXZhdGFyVXJsPzogc3RyaW5nXG4gIHBvc3RzQ291bnQ/OiBudW1iZXJcbiAgZm9sbG93ZXJzQ291bnQ/OiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQZW5kaW5nRG93bmxvYWQge1xuICBzaG9ydGNvZGVzOiBzdHJpbmdbXVxuICB2aWRlb1VybHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz5cbiAgbmljaGVzOiBOaWNoZVtdXG4gIHByb2ZpbGVVcmw6IHN0cmluZ1xuICBwcm9maWxlPzogUHJvZmlsZUluZm9cbiAgcGxhdGZvcm06IFBsYXRmb3JtXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVlbEluZm8ge1xuICBzaG9ydGNvZGU6IHN0cmluZ1xuICB2aWRlb1VybDogc3RyaW5nXG4gIHRodW1ibmFpbFVybD86IHN0cmluZ1xufVxuXG5leHBvcnQgdHlwZSBQbGF0Zm9ybSA9ICdJTlNUQUdSQU0nIHwgJ0ZBQ0VCT09LJyB8ICdZT1VUVUJFJ1xuXG5leHBvcnQgaW50ZXJmYWNlIERvd25sb2FkVGFzayB7XG4gIGlkOiBzdHJpbmdcbiAgc2hvcnRjb2RlOiBzdHJpbmdcbiAgdmlkZW9Vcmw6IHN0cmluZ1xuICBuaWNoZUlkOiBzdHJpbmdcbiAgcGxhdGZvcm06IFBsYXRmb3JtXG4gIHN0YXR1czogJ3F1ZXVlZCcgfCAnZG93bmxvYWRpbmcnIHwgJ3VwbG9hZGluZycgfCAnY29tcGxldGVkJyB8ICdlcnJvcidcbiAgcHJvZ3Jlc3M6IG51bWJlclxuICBlcnJvcj86IHN0cmluZ1xuICBmaWxlbmFtZT86IHN0cmluZ1xuICBjcmVhdGVkQXQ6IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5pY2hlIHtcbiAgaWQ6IHN0cmluZ1xuICBub21lOiBzdHJpbmdcbiAgY29yOiBzdHJpbmcgfCBudWxsXG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTkZJRzogUG9zdFJlZWxzQ29uZmlnID0ge1xuICBhcGlVcmw6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICBtaW5pb0VuZHBvaW50OiAnaHR0cDovL2xvY2FsaG9zdDo5MDAwJyxcbiAgbWluaW9BY2Nlc3NLZXk6ICdtaW5pb2FkbWluJyxcbiAgbWluaW9TZWNyZXRLZXk6ICdtaW5pb2FkbWluJyxcbiAgbWluaW9CdWNrZXQ6ICdwb3N0cmVlbHMtZG93bmxvYWRzJyxcbiAgY29uY3VycmVuY3k6IDMsXG4gIHNjcm9sbERlbGF5OiAxNTAwLFxuICBtYXhTY3JvbGxzOiA1MCxcbiAgbWF4RG93bmxvYWRzOiAyMCxcbn1cbiIsImltcG9ydCB7IGRlZmluZUNvbnRlbnRTY3JpcHQgfSBmcm9tICd3eHQvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0J1xuaW1wb3J0IHsgZ2V0QWxsUmVlbExpbmtzLCBleHRyYWN0UmVlbHNGcm9tUGFnZSwgZXh0cmFjdFByb2ZpbGVJbmZvLCBpc1JlZWxzUGFnZSwgaXNQcm9maWxlUGFnZSB9IGZyb20gJy4uL3NyYy9saWIvaW5zdGFncmFtJ1xuaW1wb3J0IHsgREVGQVVMVF9DT05GSUcgfSBmcm9tICcuLi9zcmMvbGliL3R5cGVzJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovL3d3dy5pbnN0YWdyYW0uY29tLyonXSxcbiAgbWFpbigpIHtcbiAgICBsZXQgZG93bmxvYWRCdXR0b246IEhUTUxEaXZFbGVtZW50IHwgbnVsbCA9IG51bGxcbiAgICBsZXQgaXNTY2FubmluZyA9IGZhbHNlXG5cbiAgICBmdW5jdGlvbiBpbmplY3RUb29sYmFyKCkge1xuICAgICAgaWYgKGRvd25sb2FkQnV0dG9uKSByZXR1cm5cbiAgICAgIGlmICghaXNSZWVsc1BhZ2UoKSAmJiAhaXNQcm9maWxlUGFnZSgpKSByZXR1cm5cblxuICAgICAgZG93bmxvYWRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxuICAgICAgZG93bmxvYWRCdXR0b24uaW5uZXJIVE1MID0gYFxuICAgICAgICA8ZGl2IHN0eWxlPVwiXG4gICAgICAgICAgcG9zaXRpb246Zml4ZWQ7Ym90dG9tOjI0cHg7cmlnaHQ6MjRweDt6LWluZGV4Ojk5OTk5O1xuICAgICAgICAgIGRpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjhweDtcbiAgICAgICAgICBmb250LWZhbWlseTpzYW5zLXNlcmlmO1xuICAgICAgICBcIj5cbiAgICAgICAgICA8YnV0dG9uIGlkPVwicHItc2Nhbi1idG5cIiBzdHlsZT1cIlxuICAgICAgICAgICAgYmFja2dyb3VuZDojMDA5NWY2O2NvbG9yOndoaXRlO2JvcmRlcjpub25lO1xuICAgICAgICAgICAgcGFkZGluZzoxMnB4IDIwcHg7Ym9yZGVyLXJhZGl1czo4cHg7XG4gICAgICAgICAgICBmb250LXNpemU6MTRweDtmb250LXdlaWdodDo2MDA7Y3Vyc29yOnBvaW50ZXI7XG4gICAgICAgICAgICBib3gtc2hhZG93OjAgNHB4IDEycHggcmdiYSgwLDE0OSwyNDYsMC40KTtcbiAgICAgICAgICAgIHRyYW5zaXRpb246dHJhbnNmb3JtIDAuMnM7XG4gICAgICAgICAgXCI+8J+TpSBCYWl4YXIgUmVlbHM8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGlkPVwicHItc3RhdHVzXCIgc3R5bGU9XCJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IzFhMWEyZTtjb2xvcjojZTBlMGUwO2JvcmRlci1yYWRpdXM6OHB4O1xuICAgICAgICAgICAgcGFkZGluZzo4cHggMTJweDtmb250LXNpemU6MTJweDtkaXNwbGF5Om5vbmU7XG4gICAgICAgICAgICBtYXgtd2lkdGg6MjgwcHg7XG4gICAgICAgICAgXCI+PC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgYFxuXG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRvd25sb2FkQnV0dG9uKVxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByLXNjYW4tYnRuJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgc3RhcnRTY2FuKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbGxlY3RSZWVscygpOiB7IHNob3J0Y29kZXM6IHN0cmluZ1tdOyB2aWRlb1VybHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfSB7XG4gICAgICBjb25zdCByZWVscyA9IGV4dHJhY3RSZWVsc0Zyb21QYWdlKClcbiAgICAgIGNvbnN0IHNob3J0Y29kZXM6IHN0cmluZ1tdID0gW11cbiAgICAgIGNvbnN0IHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XG5cbiAgICAgIGZvciAoY29uc3QgcmVlbCBvZiByZWVscykge1xuICAgICAgICBzaG9ydGNvZGVzLnB1c2gocmVlbC5zaG9ydGNvZGUpXG4gICAgICAgIGlmIChyZWVsLnZpZGVvVXJsKSB7XG4gICAgICAgICAgdmlkZW9VcmxzW3JlZWwuc2hvcnRjb2RlXSA9IHJlZWwudmlkZW9VcmxcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4geyBzaG9ydGNvZGVzLCB2aWRlb1VybHMgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1lcmdlUmVlbHMoXG4gICAgICBleGlzdGluZzogeyBzaG9ydGNvZGVzOiBTZXQ8c3RyaW5nPjsgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0sXG4gICAgICBpbmNvbWluZzogeyBzaG9ydGNvZGVzOiBzdHJpbmdbXTsgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IH0sXG4gICAgKSB7XG4gICAgICBmb3IgKGNvbnN0IHNjIG9mIGluY29taW5nLnNob3J0Y29kZXMpIHtcbiAgICAgICAgZXhpc3Rpbmcuc2hvcnRjb2Rlcy5hZGQoc2MpXG4gICAgICAgIGlmIChpbmNvbWluZy52aWRlb1VybHNbc2NdKSB7XG4gICAgICAgICAgZXhpc3RpbmcudmlkZW9VcmxzW3NjXSA9IGluY29taW5nLnZpZGVvVXJsc1tzY11cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIHJlYWRDb25maWcoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zeW5jLmdldCgncG9zdHJlZWxzQ29uZmlnJylcbiAgICAgICAgcmV0dXJuIHsgLi4uREVGQVVMVF9DT05GSUcsIC4uLnJlc3VsdC5wb3N0cmVlbHNDb25maWcgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBERUZBVUxUX0NPTkZJR1xuICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGZ1bmN0aW9uIHN0YXJ0U2NhbigpIHtcbiAgICAgIGlmIChpc1NjYW5uaW5nKSByZXR1cm5cbiAgICAgIGlzU2Nhbm5pbmcgPSB0cnVlXG5cbiAgICAgIGNvbnN0IHN0YXR1c0VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ByLXN0YXR1cycpXG4gICAgICBpZiAoIXN0YXR1c0VsKSByZXR1cm5cbiAgICAgIHN0YXR1c0VsLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snXG4gICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9ICfwn5SNIEluaWNpYW5kbyB2YXJyZWR1cmEuLi4nXG5cbiAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHJlYWRDb25maWcoKVxuXG4gICAgICBjb25zdCBzaG9ydGNvZGVzID0gbmV3IFNldDxzdHJpbmc+KClcbiAgICAgIGNvbnN0IHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XG5cbiAgICAgIG1lcmdlUmVlbHMoeyBzaG9ydGNvZGVzLCB2aWRlb1VybHMgfSwgY29sbGVjdFJlZWxzKCkpXG4gICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9IGDwn5SNIEVuY29udHJhZG9zICR7c2hvcnRjb2Rlcy5zaXplfSB2w61kZW9zLi4uIFJvbGFuZG8gcMOhZ2luYWBcblxuICAgICAgbGV0IHNjcm9sbENvdW50ID0gMFxuICAgICAgY29uc3Qgbm9OZXdMaW1pdCA9IDVcblxuICAgICAgd2hpbGUgKHNob3J0Y29kZXMuc2l6ZSA8IGNvbmZpZy5tYXhEb3dubG9hZHMgJiYgc2Nyb2xsQ291bnQgPCBjb25maWcubWF4U2Nyb2xscykge1xuICAgICAgICBjb25zdCBiZWZvcmUgPSBzaG9ydGNvZGVzLnNpemVcblxuICAgICAgICB3aW5kb3cuc2Nyb2xsQnkoMCwgMTUwMClcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIGNvbmZpZy5zY3JvbGxEZWxheSkpXG5cbiAgICAgICAgbWVyZ2VSZWVscyh7IHNob3J0Y29kZXMsIHZpZGVvVXJscyB9LCBjb2xsZWN0UmVlbHMoKSlcblxuICAgICAgICBpZiAoc2hvcnRjb2Rlcy5zaXplID09PSBiZWZvcmUpIHtcbiAgICAgICAgICBpZiAoKytzY3JvbGxDb3VudCA+PSBub05ld0xpbWl0KSBicmVha1xuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9IGDwn5SNIEVuY29udHJhZG9zICR7c2hvcnRjb2Rlcy5zaXplfSB2w61kZW9zLi4uIFJvbGFuZG8gKCR7c2Nyb2xsQ291bnQgKyAxfS8ke2NvbmZpZy5tYXhTY3JvbGxzfSlgXG4gICAgICAgIHNjcm9sbENvdW50ID0gMCAvLyByZXNldCBuby1uZXcgY291bnRlciB3aGVuIHdlIGZpbmQgbmV3IG9uZXNcbiAgICAgIH1cblxuICAgICAgc3RhdHVzRWwudGV4dENvbnRlbnQgPSBg4pyFICR7c2hvcnRjb2Rlcy5zaXplfSB2w61kZW9zIGVuY29udHJhZG9zIWBcblxuICAgICAgLy8gQ2FwdHVyZSBwcm9maWxlIGluZm9cbiAgICAgIGNvbnN0IHByb2ZpbGUgPSBleHRyYWN0UHJvZmlsZUluZm8oKVxuXG4gICAgICBsZXQgbmljaGVzOiBBcnJheTx7IGlkOiBzdHJpbmc7IG5vbWU6IHN0cmluZyB9PiA9IFtdXG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKCdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXBpL25pY2hvcycsIHtcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH0pXG4gICAgICAgIGlmIChyZXMub2spIHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKVxuICAgICAgICAgIGlmIChkYXRhLnN1Y2Nlc3MgJiYgZGF0YS5kYXRhKSB7XG4gICAgICAgICAgICBuaWNoZXMgPSBkYXRhLmRhdGFcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLndhcm4oJ1tDb250ZW50XSBBdmlzbyBhbyBjYXJyZWdhciBuaWNob3MgKHNlcsOhIHJlY2FycmVnYWRvIG5vIHBvcHVwKTonLCBlcnIpXG4gICAgICB9XG5cbiAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKFxuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogJ0RPV05MT0FEX1JFRUxTJyxcbiAgICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgICBzaG9ydGNvZGVzOiBBcnJheS5mcm9tKHNob3J0Y29kZXMpLFxuICAgICAgICAgICAgdmlkZW9VcmxzLFxuICAgICAgICAgICAgcHJvZmlsZVVybDogd2luZG93LmxvY2F0aW9uLmhyZWYsXG4gICAgICAgICAgICBuaWNoZXMsXG4gICAgICAgICAgICBwcm9maWxlLFxuICAgICAgICAgICAgcGxhdGZvcm06ICdJTlNUQUdSQU0nLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIChyZXNwb25zZTogYW55KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tDb250ZW50XSBSZXNwb3N0YSBkbyBiYWNrZ3JvdW5kOicsIHJlc3BvbnNlKVxuICAgICAgICAgIGlmIChyZXNwb25zZT8uc3VjY2Vzcykge1xuICAgICAgICAgICAgc3RhdHVzRWwudGV4dENvbnRlbnQgPSBg4pyFICR7c2hvcnRjb2Rlcy5zaXplfSB2w61kZW9zIGVuY29udHJhZG9zISBWZXJpZmlxdWUgbyBwb3B1cCBkYSBleHRlbnPDo28uYFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0dXNFbC50ZXh0Q29udGVudCA9IGDinYwgRXJybyBhbyBlbnZpYXIgcGFyYSBkb3dubG9hZGBcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIClcblxuICAgICAgaXNTY2FubmluZyA9IGZhbHNlXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJ5SW5qZWN0KCkge1xuICAgICAgaWYgKGlzUmVlbHNQYWdlKCkgfHwgaXNQcm9maWxlUGFnZSgpKSB7XG4gICAgICAgIGluamVjdFRvb2xiYXIoKVxuICAgICAgfVxuICAgIH1cblxuICAgIHRyeUluamVjdCgpXG5cbiAgICBjb25zdCBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHtcbiAgICAgIGlmICghZG93bmxvYWRCdXR0b24gfHwgIWRvY3VtZW50LmJvZHkuY29udGFpbnMoZG93bmxvYWRCdXR0b24pKSB7XG4gICAgICAgIGRvd25sb2FkQnV0dG9uID0gbnVsbFxuICAgICAgICB0cnlJbmplY3QoKVxuICAgICAgfVxuICAgIH0pXG4gICAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KVxuXG4gICAgbGV0IGxhc3RVcmwgPSBsb2NhdGlvbi5ocmVmXG4gICAgY29uc3QgdXJsT2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7XG4gICAgICBpZiAobG9jYXRpb24uaHJlZiAhPT0gbGFzdFVybCkge1xuICAgICAgICBsYXN0VXJsID0gbG9jYXRpb24uaHJlZlxuICAgICAgICBzZXRUaW1lb3V0KHRyeUluamVjdCwgMTAwMClcbiAgICAgIH1cbiAgICB9KVxuICAgIHVybE9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSlcbiAgfSxcbn0pXG4iLCIvLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2xvZ2dlci50c1xuZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG5cdGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcblx0aWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSBtZXRob2QoYFt3eHRdICR7YXJncy5zaGlmdCgpfWAsIC4uLmFyZ3MpO1xuXHRlbHNlIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xufVxuLyoqIFdyYXBwZXIgYXJvdW5kIGBjb25zb2xlYCB3aXRoIGEgXCJbd3h0XVwiIHByZWZpeCAqL1xuY29uc3QgbG9nZ2VyID0ge1xuXHRkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuXHRsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG5cdHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuXHRlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBsb2dnZXIgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMudHNcbnZhciBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50ID0gY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcblx0c3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG5cdGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG5cdFx0c3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG5cdFx0dGhpcy5uZXdVcmwgPSBuZXdVcmw7XG5cdFx0dGhpcy5vbGRVcmwgPSBvbGRVcmw7XG5cdH1cbn07XG4vKipcbiogUmV0dXJucyBhbiBldmVudCBuYW1lIHVuaXF1ZSB0byB0aGUgZXh0ZW5zaW9uIGFuZCBjb250ZW50IHNjcmlwdCB0aGF0J3NcbiogcnVubmluZy5cbiovXG5mdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG5cdHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCwgZ2V0VW5pcXVlRXZlbnROYW1lIH07XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci50c1xuY29uc3Qgc3VwcG9ydHNOYXZpZ2F0aW9uQXBpID0gdHlwZW9mIGdsb2JhbFRoaXMubmF2aWdhdGlvbj8uYWRkRXZlbnRMaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiO1xuLyoqXG4qIENyZWF0ZSBhIHV0aWwgdGhhdCB3YXRjaGVzIGZvciBVUkwgY2hhbmdlcywgZGlzcGF0Y2hpbmcgdGhlIGN1c3RvbSBldmVudCB3aGVuXG4qIGRldGVjdGVkLiBTdG9wcyB3YXRjaGluZyB3aGVuIGNvbnRlbnQgc2NyaXB0IGlzIGludmFsaWRhdGVkLiBVc2VzIE5hdmlnYXRpb25cbiogQVBJIHdoZW4gYXZhaWxhYmxlLCBvdGhlcndpc2UgZmFsbHMgYmFjayB0byBwb2xsaW5nLlxuKi9cbmZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcblx0bGV0IGxhc3RVcmw7XG5cdGxldCB3YXRjaGluZyA9IGZhbHNlO1xuXHRyZXR1cm4geyBydW4oKSB7XG5cdFx0aWYgKHdhdGNoaW5nKSByZXR1cm47XG5cdFx0d2F0Y2hpbmcgPSB0cnVlO1xuXHRcdGxhc3RVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuXHRcdGlmIChzdXBwb3J0c05hdmlnYXRpb25BcGkpIGdsb2JhbFRoaXMubmF2aWdhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwibmF2aWdhdGVcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXdVcmwgPSBuZXcgVVJMKGV2ZW50LmRlc3RpbmF0aW9uLnVybCk7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgPT09IGxhc3RVcmwuaHJlZikgcmV0dXJuO1xuXHRcdFx0d2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBsYXN0VXJsKSk7XG5cdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdH0sIHsgc2lnbmFsOiBjdHguc2lnbmFsIH0pO1xuXHRcdGVsc2UgY3R4LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgIT09IGxhc3RVcmwuaHJlZikge1xuXHRcdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdFx0bGFzdFVybCA9IG5ld1VybDtcblx0XHRcdH1cblx0XHR9LCAxZTMpO1xuXHR9IH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9O1xuIiwiaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgZ2V0VW5pcXVlRXZlbnROYW1lIH0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQudHNcbi8qKlxuKiBJbXBsZW1lbnRzXG4qIFtgQWJvcnRDb250cm9sbGVyYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0Fib3J0Q29udHJvbGxlcikuXG4qIFVzZWQgdG8gZGV0ZWN0IGFuZCBzdG9wIGNvbnRlbnQgc2NyaXB0IGNvZGUgd2hlbiB0aGUgc2NyaXB0IGlzIGludmFsaWRhdGVkLlxuKlxuKiBJdCBhbHNvIHByb3ZpZGVzIHNldmVyYWwgdXRpbGl0aWVzIGxpa2UgYGN0eC5zZXRUaW1lb3V0YCBhbmRcbiogYGN0eC5zZXRJbnRlcnZhbGAgdGhhdCBzaG91bGQgYmUgdXNlZCBpbiBjb250ZW50IHNjcmlwdHMgaW5zdGVhZCBvZlxuKiBgd2luZG93LnNldFRpbWVvdXRgIG9yIGB3aW5kb3cuc2V0SW50ZXJ2YWxgLlxuKlxuKiBUbyBjcmVhdGUgY29udGV4dCBmb3IgdGVzdGluZywgeW91IGNhbiB1c2UgdGhlIGNsYXNzJ3MgY29uc3RydWN0b3I6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0cy1jb250ZXh0JztcbipcbiogdGVzdCgnc3RvcmFnZSBsaXN0ZW5lciBzaG91bGQgYmUgcmVtb3ZlZCB3aGVuIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQnLCAoKSA9PiB7XG4qICAgY29uc3QgY3R4ID0gbmV3IENvbnRlbnRTY3JpcHRDb250ZXh0KCd0ZXN0Jyk7XG4qICAgY29uc3QgaXRlbSA9IHN0b3JhZ2UuZGVmaW5lSXRlbSgnbG9jYWw6Y291bnQnLCB7IGRlZmF1bHRWYWx1ZTogMCB9KTtcbiogICBjb25zdCB3YXRjaGVyID0gdmkuZm4oKTtcbipcbiogICBjb25zdCB1bndhdGNoID0gaXRlbS53YXRjaCh3YXRjaGVyKTtcbiogICBjdHgub25JbnZhbGlkYXRlZCh1bndhdGNoKTsgLy8gTGlzdGVuIGZvciBpbnZhbGlkYXRlIGhlcmVcbipcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDEpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRXaXRoKDEsIDApO1xuKlxuKiAgIGN0eC5ub3RpZnlJbnZhbGlkYXRlZCgpOyAvLyBVc2UgdGhpcyBmdW5jdGlvbiB0byBpbnZhbGlkYXRlIHRoZSBjb250ZXh0XG4qICAgYXdhaXQgaXRlbS5zZXRWYWx1ZSgyKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFRpbWVzKDEpO1xuKiB9KTtcbiogYGBgXG4qL1xudmFyIENvbnRlbnRTY3JpcHRDb250ZXh0ID0gY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuXHRzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIik7XG5cdGlkO1xuXHRhYm9ydENvbnRyb2xsZXI7XG5cdGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcblx0Y29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcblx0XHR0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLmlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMik7XG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0dGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuXHRcdHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG5cdH1cblx0Z2V0IHNpZ25hbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuXHR9XG5cdGFib3J0KHJlYXNvbikge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuXHR9XG5cdGdldCBpc0ludmFsaWQoKSB7XG5cdFx0aWYgKGJyb3dzZXIucnVudGltZT8uaWQgPT0gbnVsbCkgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuXHR9XG5cdGdldCBpc1ZhbGlkKCkge1xuXHRcdHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG5cdH1cblx0LyoqXG5cdCogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzXG5cdCogaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG5cdCogICBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuXHQqICAgICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcblx0KiAgIH0pO1xuXHQqICAgLy8gLi4uXG5cdCogICByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG5cdCpcblx0KiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG5cdCovXG5cdG9uSW52YWxpZGF0ZWQoY2IpIHtcblx0XHR0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHRcdHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHR9XG5cdC8qKlxuXHQqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uXG5cdCogdGhhdCBzaG91bGRuJ3QgcnVuIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcblx0KiAgICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcblx0KlxuXHQqICAgICAvLyAuLi5cblx0KiAgIH07XG5cdCovXG5cdGJsb2NrKCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7fSk7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcblx0XHRjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsXG5cdCogd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHNcblx0KiB0aGUgcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcblx0XHRjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG5cdFx0fSk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlXG5cdCogcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2Bcblx0KiBmdW5jdGlvbi5cblx0Ki9cblx0cmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9LCBvcHRpb25zKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG5cdFx0aWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuXHRcdH1cblx0XHR0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLCBoYW5kbGVyLCB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0c2lnbmFsOiB0aGlzLnNpZ25hbFxuXHRcdH0pO1xuXHR9XG5cdC8qKlxuXHQqIEBpbnRlcm5hbFxuXHQqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuXHQqL1xuXHRub3RpZnlJbnZhbGlkYXRlZCgpIHtcblx0XHR0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcblx0XHRsb2dnZXIuZGVidWcoYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgKTtcblx0fVxuXHRzdG9wT2xkU2NyaXB0cygpIHtcblx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIHsgZGV0YWlsOiB7XG5cdFx0XHRjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcblx0XHRcdG1lc3NhZ2VJZDogdGhpcy5pZFxuXHRcdH0gfSkpO1xuXHRcdGlmICghdGhpcy5vcHRpb25zPy5ub1NjcmlwdFN0YXJ0ZWRQb3N0TWVzc2FnZSkgd2luZG93LnBvc3RNZXNzYWdlKHtcblx0XHRcdHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSwgXCIqXCIpO1xuXHR9XG5cdHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuXHRcdGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kZXRhaWw/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuXHRcdGNvbnN0IGlzRnJvbVNlbGYgPSBldmVudC5kZXRhaWw/Lm1lc3NhZ2VJZCA9PT0gdGhpcy5pZDtcblx0XHRyZXR1cm4gaXNTYW1lQ29udGVudFNjcmlwdCAmJiAhaXNGcm9tU2VsZjtcblx0fVxuXHRsaXN0ZW5Gb3JOZXdlclNjcmlwdHMoKSB7XG5cdFx0Y29uc3QgY2IgPSAoZXZlbnQpID0+IHtcblx0XHRcdGlmICghKGV2ZW50IGluc3RhbmNlb2YgQ3VzdG9tRXZlbnQpIHx8ICF0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHJldHVybjtcblx0XHRcdHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcblx0XHR9O1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYik7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYikpO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9O1xuIl0sInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDQsNSw2LDcsOCw5XSwibWFwcGluZ3MiOiI7O0NBQ0EsU0FBUyxvQkFBb0IsWUFBWTtFQUN4QyxPQUFPO0NBQ1I7OztDQ0RBLFNBQWdCLHVCQUFtQztFQUNqRCxNQUFNLFFBQW9CLENBQUM7RUFDM0IsTUFBTSx1QkFBTyxJQUFJLElBQVk7RUFJN0IsU0FGdUIsaUJBQWlCLHFCQUV4QyxDQUFBLENBQU0sU0FBUSxTQUFRO0dBQ3BCLE1BQU0sT0FBTyxLQUFLLGFBQWEsTUFBTTtH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