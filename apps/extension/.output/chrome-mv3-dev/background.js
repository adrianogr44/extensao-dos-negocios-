var background = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20.19.43_eslint@8.57.1_jiti@2.7.0_rolldown@1.1.5/node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/lib/downloader.ts
	var DownloadManager = class {
		queue = [];
		active = /* @__PURE__ */ new Map();
		config;
		onUpdate;
		running = 0;
		profile = null;
		constructor(config, onUpdate) {
			this.config = config;
			this.onUpdate = onUpdate;
		}
		addTasks(tasks, profile) {
			if (profile) this.profile = profile;
			this.queue.push(...tasks);
			this.processQueue();
		}
		async processQueue() {
			while (this.running < this.config.concurrency && this.queue.length > 0) {
				const task = this.queue.shift();
				if (!task) break;
				this.running++;
				this.downloadTask(task).finally(() => {
					this.running--;
					this.processQueue();
				});
			}
		}
		async downloadTask(task) {
			const controller = new AbortController();
			this.active.set(task.id, controller);
			try {
				console.log("[Downloader] Iniciando download:", task.shortcode);
				task.status = "downloading";
				this.onUpdate(task);
				const platform = task.platform || "INSTAGRAM";
				const url = `${this.config.apiUrl}/api/videos/download`;
				console.log("[Downloader] Chamando endpoint:", url);
				const body = {
					shortcode: task.shortcode,
					nicheId: task.nicheId,
					platform
				};
				if (this.profile) body.profile = this.profile;
				const response = await fetch(url, {
					method: "POST",
					signal: controller.signal,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body)
				});
				console.log("[Downloader] Resposta recebida:", response.status, response.statusText);
				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || `HTTP ${response.status}`);
				}
				const data = await response.json();
				console.log("[Downloader] Download concluído:", task.shortcode);
				task.filename = data.data.filename;
				task.status = "completed";
				task.progress = 100;
				this.onUpdate(task);
			} catch (err) {
				const errMsg = err.message;
				console.error("[Downloader] Erro:", errMsg);
				if (err.name === "AbortError") return;
				task.status = "error";
				task.error = errMsg;
				this.onUpdate(task);
			} finally {
				this.active.delete(task.id);
			}
		}
		cancelTask(id) {
			const controller = this.active.get(id);
			if (controller) {
				controller.abort();
				this.active.delete(id);
			}
			this.queue = this.queue.filter((t) => t.id !== id);
		}
		cancelAll() {
			this.active.forEach((c) => c.abort());
			this.active.clear();
			this.queue = [];
		}
	};
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
	//#region entrypoints/background.ts
	var downloadManager = null;
	var tasks = [];
	var currentNiches = [];
	var pendingDownload = null;
	async function getConfig() {
		const result = await chrome.storage.sync.get("postreelsConfig");
		return {
			...DEFAULT_CONFIG,
			...result.postreelsConfig
		};
	}
	function broadcastToPopup(message) {
		console.log("[Background] Enviando para popup:", message.type);
		chrome.runtime.sendMessage(message).catch(() => {
			console.log("[Background] Popup não está aberto");
		});
	}
	function broadcastTasks() {
		broadcastToPopup({
			type: "TASKS_UPDATED",
			payload: tasks
		});
	}
	async function startDownloads(shortcodes, videoUrls, nicheId, profile, platform = "INSTAGRAM") {
		const config = await getConfig();
		const limit = config.maxDownloads || shortcodes.length;
		const newTasks = shortcodes.slice(0, limit).map((sc) => ({
			id: crypto.randomUUID(),
			shortcode: sc,
			videoUrl: videoUrls[sc] || `https://www.${platform.toLowerCase()}.com/${platform === "YOUTUBE" ? "shorts" : "reel"}/${sc}/`,
			nicheId,
			platform,
			status: "queued",
			progress: 0,
			createdAt: Date.now()
		}));
		tasks.push(...newTasks);
		console.log("[Background] Tarefas criadas:", newTasks.length);
		broadcastTasks();
		downloadManager = new DownloadManager(config, (updatedTask) => {
			const idx = tasks.findIndex((t) => t.id === updatedTask.id);
			if (idx !== -1) {
				tasks[idx] = { ...updatedTask };
				broadcastTasks();
			}
		});
		downloadManager.addTasks(newTasks, profile);
	}
	var background_default = defineBackground(() => {
		console.log("[Background] Iniciado");
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			console.log("[Background] Mensagem:", message.type);
			switch (message.type) {
				case "DOWNLOAD_REELS": {
					const { shortcodes, videoUrls, niches, profileUrl, profile, platform = "INSTAGRAM" } = message.payload;
					console.log("[Background] Recebido DOWNLOAD_REELS:", shortcodes.length, "vídeos");
					currentNiches = niches || [];
					pendingDownload = {
						shortcodes,
						videoUrls,
						niches: niches || [],
						profileUrl,
						profile,
						platform
					};
					chrome.action.setBadgeText({ text: String(shortcodes.length) });
					chrome.action.setBadgeBackgroundColor({ color: "#0095f6" });
					broadcastToPopup({
						type: "PENDING_DOWNLOAD_UPDATED",
						payload: pendingDownload
					});
					sendResponse({ success: true });
					break;
				}
				case "START_DOWNLOAD": {
					const { shortcodes, videoUrls, nicheId, profile, platform = "INSTAGRAM" } = message.payload;
					console.log("[Background] Iniciando download de", shortcodes.length, "vídeos");
					pendingDownload = null;
					chrome.action.setBadgeText({ text: "" });
					startDownloads(shortcodes, videoUrls, nicheId, profile, platform);
					sendResponse({ success: true });
					break;
				}
				case "GET_PENDING_DOWNLOAD":
					console.log("[Background] GET_PENDING_DOWNLOAD -", !!pendingDownload ? "tem" : "vazio");
					sendResponse({
						success: true,
						data: pendingDownload
					});
					break;
				case "GET_TASKS":
					console.log("[Background] GET_TASKS -", tasks.length, "tarefas");
					sendResponse({
						success: true,
						data: tasks
					});
					break;
				case "CANCEL_TASK": {
					const { id } = message.payload;
					downloadManager?.cancelTask(id);
					tasks = tasks.filter((t) => t.id !== id);
					broadcastTasks();
					sendResponse({ success: true });
					break;
				}
				case "CANCEL_ALL":
					downloadManager?.cancelAll();
					tasks = tasks.filter((t) => t.status === "completed" || t.status === "error");
					broadcastTasks();
					sendResponse({ success: true });
					break;
				case "CLEAR_COMPLETED":
					tasks = tasks.filter((t) => t.status === "queued" || t.status === "downloading");
					broadcastTasks();
					sendResponse({ success: true });
					break;
				case "GET_NICHES":
					if (!currentNiches || currentNiches.length === 0) {
						fetch("http://localhost:3000/api/nichos").then((res) => res.json()).then((data) => {
							if (data.success && data.data) {
								currentNiches = data.data;
								sendResponse({
									success: true,
									data: currentNiches
								});
							} else sendResponse({
								success: true,
								data: []
							});
						}).catch((err) => {
							console.error("[Background] Erro ao carregar nichos:", err);
							sendResponse({
								success: true,
								data: []
							});
						});
						return true;
					} else sendResponse({
						success: true,
						data: currentNiches
					});
					break;
				case "GET_CONFIG":
					getConfig().then((config) => sendResponse({
						success: true,
						data: config
					}));
					return true;
				case "SAVE_CONFIG":
					getConfig().then((currentConfig) => {
						const updatedConfig = {
							...currentConfig,
							...message.payload
						};
						console.log("[Background] Salvando config:", updatedConfig);
						chrome.storage.sync.set({ postreelsConfig: updatedConfig }, () => {
							sendResponse({
								success: true,
								data: updatedConfig
							});
						});
					});
					return true;
				default: sendResponse({
					success: false,
					error: "Unknown type"
				});
			}
		});
	});
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
	//#region ../../node_modules/.pnpm/@webext-core+match-patterns@1.1.0/node_modules/@webext-core/match-patterns/lib/index.mjs
	/**
	* Class for parsing and performing operations on match patterns.
	*
	* @example
	*   const pattern = new MatchPattern('*://google.com/*');
	*
	*   pattern.includes('https://google.com'); // true
	*   pattern.includes('http://youtube.com/watch?v=123'); // false
	*/
	var MatchPattern = class MatchPattern {
		static {
			this.PROTOCOLS = [
				"http",
				"https",
				"file",
				"ftp",
				"urn",
				"ws",
				"wss"
			];
		}
		/**
		* Parse a match pattern string. If it is invalid, the constructor will throw an
		* `InvalidMatchPattern` error.
		*
		* @param matchPattern The match pattern to parse.
		*/
		constructor(matchPattern) {
			if (matchPattern === "<all_urls>") {
				this.isAllUrls = true;
				this.protocolMatches = [...MatchPattern.PROTOCOLS];
				this.hostnameMatch = "*";
				this.pathnameMatch = "*";
			} else {
				const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
				if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
				const [_, protocol, hostname, pathname] = groups;
				validateProtocol(matchPattern, protocol);
				validateHostname(matchPattern, hostname);
				this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
				this.hostnameMatch = hostname;
				this.pathnameMatch = pathname;
			}
		}
		/** Check if a URL is included in a pattern. */
		includes(url) {
			const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
			if (this.isAllUrls) return !this.isUnknownProtocol(u);
			return !!this.protocolMatches.find((protocol) => {
				if (protocol === "http") return this.isHttpMatch(u);
				if (protocol === "https") return this.isHttpsMatch(u);
				if (protocol === "file") return this.isFileMatch(u);
				if (protocol === "ftp") return this.isFtpMatch(u);
				if (protocol === "urn") return this.isUrnMatch(u);
			});
		}
		isHttpMatch(url) {
			return url.protocol === "http:" && this.isHostPathMatch(url);
		}
		isHttpsMatch(url) {
			return url.protocol === "https:" && this.isHostPathMatch(url);
		}
		isHostPathMatch(url) {
			if (!this.hostnameMatch || !this.pathnameMatch) return false;
			const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
			const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
			return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
		}
		isUnknownProtocol(url) {
			return !this.protocolMatches.includes(url.protocol.slice(0, -1));
		}
		isPathMatch(url) {
			if (!this.pathnameMatch) return false;
			return this.convertPatternToRegex(this.pathnameMatch).test(url.pathname);
		}
		isFileMatch(url) {
			return url.protocol === "file:" && this.isPathMatch(url);
		}
		isFtpMatch(_url) {
			throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
		}
		isUrnMatch(_url) {
			throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
		}
		convertPatternToRegex(pattern) {
			const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
			return RegExp(`^${starsReplaced}$`);
		}
		escapeForRegex(string) {
			return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
	};
	var InvalidMatchPattern = class extends Error {
		constructor(matchPattern, reason) {
			super(`Invalid match pattern "${matchPattern}": ${reason}`);
		}
	};
	function validateProtocol(matchPattern, protocol) {
		if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
	}
	function validateHostname(matchPattern, hostname) {
		if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
		if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
	}
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?/home/gosantos/projects/postreels-v2/apps/extension/entrypoints/background.ts
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
	var ws;
	/** Connect to the websocket and listen for messages. */
	function getDevServerWebSocket() {
		if (ws == null) {
			const serverUrl = "ws://localhost:3001";
			logger.debug("Connecting to dev server @", serverUrl);
			ws = new WebSocket(serverUrl, "vite-hmr");
			ws.addWxtEventListener = ws.addEventListener.bind(ws);
			ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({
				type: "custom",
				event,
				payload
			}));
			ws.addEventListener("open", () => {
				logger.debug("Connected to dev server");
			});
			ws.addEventListener("close", () => {
				logger.debug("Disconnected from dev server");
			});
			ws.addEventListener("error", (event) => {
				logger.error("Failed to connect to dev server", event);
			});
			ws.addEventListener("message", (e) => {
				try {
					const message = JSON.parse(e.data);
					if (message.type === "custom") ws?.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
				} catch (err) {
					logger.error("Failed to handle message", err);
				}
			});
		}
		return ws;
	}
	/** https://developer.chrome.com/blog/longer-esw-lifetimes/ */
	function keepServiceWorkerAlive() {
		setInterval(async () => {
			await browser.runtime.getPlatformInfo();
		}, 5e3);
	}
	function reloadContentScript(payload) {
		if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2(payload);
		else reloadContentScriptMv3(payload);
	}
	async function reloadContentScriptMv3({ registration, contentScript }) {
		if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
		else await reloadManifestContentScriptMv3(contentScript);
	}
	async function reloadManifestContentScriptMv3(contentScript) {
		const id = `wxt:${contentScript.js[0]}`;
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const existing = registered.find((cs) => cs.id === id);
		if (existing) {
			logger.debug("Updating content script", existing);
			await browser.scripting.updateContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		} else {
			logger.debug("Registering new content script...");
			await browser.scripting.registerContentScripts([{
				...contentScript,
				id,
				css: contentScript.css ?? []
			}]);
		}
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadRuntimeContentScriptMv3(contentScript) {
		logger.log("Reloading content script:", contentScript);
		const registered = await browser.scripting.getRegisteredContentScripts();
		logger.debug("Existing scripts:", registered);
		const matches = registered.filter((cs) => {
			const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
			const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
			return hasJs || hasCss;
		});
		if (matches.length === 0) {
			logger.log("Content script is not registered yet, nothing to reload", contentScript);
			return;
		}
		await browser.scripting.updateContentScripts(matches);
		await reloadTabsForContentScript(contentScript);
	}
	async function reloadTabsForContentScript(contentScript) {
		const allTabs = await browser.tabs.query({});
		const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
		const matchingTabs = allTabs.filter((tab) => {
			const url = tab.url;
			if (!url) return false;
			return !!matchPatterns.find((pattern) => pattern.includes(url));
		});
		await Promise.all(matchingTabs.map(async (tab) => {
			try {
				await browser.tabs.reload(tab.id);
			} catch (err) {
				logger.warn("Failed to reload tab:", err);
			}
		}));
	}
	async function reloadContentScriptMv2(_payload) {
		throw Error("TODO: reloadContentScriptMv2");
	}
	try {
		const ws = getDevServerWebSocket();
		ws.addWxtEventListener("wxt:reload-extension", () => {
			browser.runtime.reload();
		});
		ws.addWxtEventListener("wxt:reload-content-script", (event) => {
			reloadContentScript(event.detail);
		});
		ws.addEventListener("open", () => ws.sendCustom("wxt:background-initialized"));
		keepServiceWorkerAlive();
	} catch (err) {
		logger.error("Failed to setup web socket connection with dev server", err);
	}
	browser.commands.onCommand.addListener((command) => {
		if (command === "wxt:reload-extension") browser.runtime.reload();
	});
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtYmFja2dyb3VuZC5tanMiLCIuLi8uLi9zcmMvbGliL2Rvd25sb2FkZXIudHMiLCIuLi8uLi9zcmMvbGliL3R5cGVzLnRzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC50cyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuMTkuNDNfZXNsaW50QDguNTcuMV9qaXRpQDIuNy4wX3JvbGxkb3duQDEuMS41L25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMS4xLjAvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXgubWpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IERvd25sb2FkVGFzaywgUG9zdFJlZWxzQ29uZmlnLCBQcm9maWxlSW5mbyB9IGZyb20gJy4vdHlwZXMnXG5cbnR5cGUgVGFza0NhbGxiYWNrID0gKHRhc2s6IERvd25sb2FkVGFzaykgPT4gdm9pZFxuXG5leHBvcnQgY2xhc3MgRG93bmxvYWRNYW5hZ2VyIHtcbiAgcHJpdmF0ZSBxdWV1ZTogRG93bmxvYWRUYXNrW10gPSBbXVxuICBwcml2YXRlIGFjdGl2ZSA9IG5ldyBNYXA8c3RyaW5nLCBBYm9ydENvbnRyb2xsZXI+KClcbiAgcHJpdmF0ZSBjb25maWc6IFBvc3RSZWVsc0NvbmZpZ1xuICBwcml2YXRlIG9uVXBkYXRlOiBUYXNrQ2FsbGJhY2tcbiAgcHJpdmF0ZSBydW5uaW5nID0gMFxuICBwcml2YXRlIHByb2ZpbGU6IFByb2ZpbGVJbmZvIHwgbnVsbCA9IG51bGxcblxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFBvc3RSZWVsc0NvbmZpZywgb25VcGRhdGU6IFRhc2tDYWxsYmFjaykge1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnXG4gICAgdGhpcy5vblVwZGF0ZSA9IG9uVXBkYXRlXG4gIH1cblxuICBhZGRUYXNrcyh0YXNrczogRG93bmxvYWRUYXNrW10sIHByb2ZpbGU/OiBQcm9maWxlSW5mbykge1xuICAgIGlmIChwcm9maWxlKSB0aGlzLnByb2ZpbGUgPSBwcm9maWxlXG4gICAgdGhpcy5xdWV1ZS5wdXNoKC4uLnRhc2tzKVxuICAgIHRoaXMucHJvY2Vzc1F1ZXVlKClcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc1F1ZXVlKCkge1xuICAgIHdoaWxlICh0aGlzLnJ1bm5pbmcgPCB0aGlzLmNvbmZpZy5jb25jdXJyZW5jeSAmJiB0aGlzLnF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IHRhc2sgPSB0aGlzLnF1ZXVlLnNoaWZ0KClcbiAgICAgIGlmICghdGFzaykgYnJlYWtcbiAgICAgIHRoaXMucnVubmluZysrXG4gICAgICB0aGlzLmRvd25sb2FkVGFzayh0YXNrKS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nLS1cbiAgICAgICAgdGhpcy5wcm9jZXNzUXVldWUoKVxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGRvd25sb2FkVGFzayh0YXNrOiBEb3dubG9hZFRhc2spIHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXG4gICAgdGhpcy5hY3RpdmUuc2V0KHRhc2suaWQsIGNvbnRyb2xsZXIpXG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coJ1tEb3dubG9hZGVyXSBJbmljaWFuZG8gZG93bmxvYWQ6JywgdGFzay5zaG9ydGNvZGUpXG4gICAgICB0YXNrLnN0YXR1cyA9ICdkb3dubG9hZGluZydcbiAgICAgIHRoaXMub25VcGRhdGUodGFzaylcblxuICAgICAgY29uc3QgcGxhdGZvcm0gPSB0YXNrLnBsYXRmb3JtIHx8ICdJTlNUQUdSQU0nXG4gICAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmNvbmZpZy5hcGlVcmx9L2FwaS92aWRlb3MvZG93bmxvYWRgXG4gICAgICBjb25zb2xlLmxvZygnW0Rvd25sb2FkZXJdIENoYW1hbmRvIGVuZHBvaW50OicsIHVybClcblxuICAgICAgY29uc3QgYm9keTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XG4gICAgICAgIHNob3J0Y29kZTogdGFzay5zaG9ydGNvZGUsXG4gICAgICAgIG5pY2hlSWQ6IHRhc2submljaGVJZCxcbiAgICAgICAgcGxhdGZvcm0sXG4gICAgICB9XG4gICAgICBpZiAodGhpcy5wcm9maWxlKSBib2R5LnByb2ZpbGUgPSB0aGlzLnByb2ZpbGVcblxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgIH0pXG5cbiAgICAgIGNvbnNvbGUubG9nKCdbRG93bmxvYWRlcl0gUmVzcG9zdGEgcmVjZWJpZGE6JywgcmVzcG9uc2Uuc3RhdHVzLCByZXNwb25zZS5zdGF0dXNUZXh0KVxuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvci5lcnJvciB8fCBgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXG4gICAgICBjb25zb2xlLmxvZygnW0Rvd25sb2FkZXJdIERvd25sb2FkIGNvbmNsdcOtZG86JywgdGFzay5zaG9ydGNvZGUpXG4gICAgICB0YXNrLmZpbGVuYW1lID0gZGF0YS5kYXRhLmZpbGVuYW1lXG4gICAgICB0YXNrLnN0YXR1cyA9ICdjb21wbGV0ZWQnXG4gICAgICB0YXNrLnByb2dyZXNzID0gMTAwXG4gICAgICB0aGlzLm9uVXBkYXRlKHRhc2spXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBlcnJNc2cgPSAoZXJyIGFzIEVycm9yKS5tZXNzYWdlXG4gICAgICBjb25zb2xlLmVycm9yKCdbRG93bmxvYWRlcl0gRXJybzonLCBlcnJNc2cpXG4gICAgICBpZiAoKGVyciBhcyBFcnJvcikubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSByZXR1cm5cbiAgICAgIHRhc2suc3RhdHVzID0gJ2Vycm9yJ1xuICAgICAgdGFzay5lcnJvciA9IGVyck1zZ1xuICAgICAgdGhpcy5vblVwZGF0ZSh0YXNrKVxuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLmFjdGl2ZS5kZWxldGUodGFzay5pZClcbiAgICB9XG4gIH1cblxuXG4gIGNhbmNlbFRhc2soaWQ6IHN0cmluZykge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmFjdGl2ZS5nZXQoaWQpXG4gICAgaWYgKGNvbnRyb2xsZXIpIHtcbiAgICAgIGNvbnRyb2xsZXIuYWJvcnQoKVxuICAgICAgdGhpcy5hY3RpdmUuZGVsZXRlKGlkKVxuICAgIH1cbiAgICB0aGlzLnF1ZXVlID0gdGhpcy5xdWV1ZS5maWx0ZXIodCA9PiB0LmlkICE9PSBpZClcbiAgfVxuXG4gIGNhbmNlbEFsbCgpIHtcbiAgICB0aGlzLmFjdGl2ZS5mb3JFYWNoKGMgPT4gYy5hYm9ydCgpKVxuICAgIHRoaXMuYWN0aXZlLmNsZWFyKClcbiAgICB0aGlzLnF1ZXVlID0gW11cbiAgfVxufVxuIiwiZXhwb3J0IGludGVyZmFjZSBQb3N0UmVlbHNDb25maWcge1xuICBhcGlVcmw6IHN0cmluZ1xuICBtaW5pb0VuZHBvaW50OiBzdHJpbmdcbiAgbWluaW9BY2Nlc3NLZXk6IHN0cmluZ1xuICBtaW5pb1NlY3JldEtleTogc3RyaW5nXG4gIG1pbmlvQnVja2V0OiBzdHJpbmdcbiAgY29uY3VycmVuY3k6IG51bWJlclxuICBzY3JvbGxEZWxheTogbnVtYmVyXG4gIG1heFNjcm9sbHM6IG51bWJlclxuICBtYXhEb3dubG9hZHM6IG51bWJlclxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb2ZpbGVJbmZvIHtcbiAgdXNlcm5hbWU6IHN0cmluZ1xuICBmdWxsTmFtZTogc3RyaW5nXG4gIGF2YXRhclVybD86IHN0cmluZ1xuICBwb3N0c0NvdW50PzogbnVtYmVyXG4gIGZvbGxvd2Vyc0NvdW50PzogbnVtYmVyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGVuZGluZ0Rvd25sb2FkIHtcbiAgc2hvcnRjb2Rlczogc3RyaW5nW11cbiAgdmlkZW9VcmxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gIG5pY2hlczogTmljaGVbXVxuICBwcm9maWxlVXJsOiBzdHJpbmdcbiAgcHJvZmlsZT86IFByb2ZpbGVJbmZvXG4gIHBsYXRmb3JtOiBQbGF0Zm9ybVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlZWxJbmZvIHtcbiAgc2hvcnRjb2RlOiBzdHJpbmdcbiAgdmlkZW9Vcmw6IHN0cmluZ1xuICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcbn1cblxuZXhwb3J0IHR5cGUgUGxhdGZvcm0gPSAnSU5TVEFHUkFNJyB8ICdGQUNFQk9PSycgfCAnWU9VVFVCRSdcblxuZXhwb3J0IGludGVyZmFjZSBEb3dubG9hZFRhc2sge1xuICBpZDogc3RyaW5nXG4gIHNob3J0Y29kZTogc3RyaW5nXG4gIHZpZGVvVXJsOiBzdHJpbmdcbiAgbmljaGVJZDogc3RyaW5nXG4gIHBsYXRmb3JtOiBQbGF0Zm9ybVxuICBzdGF0dXM6ICdxdWV1ZWQnIHwgJ2Rvd25sb2FkaW5nJyB8ICd1cGxvYWRpbmcnIHwgJ2NvbXBsZXRlZCcgfCAnZXJyb3InXG4gIHByb2dyZXNzOiBudW1iZXJcbiAgZXJyb3I/OiBzdHJpbmdcbiAgZmlsZW5hbWU/OiBzdHJpbmdcbiAgY3JlYXRlZEF0OiBudW1iZXJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBOaWNoZSB7XG4gIGlkOiBzdHJpbmdcbiAgbm9tZTogc3RyaW5nXG4gIGNvcjogc3RyaW5nIHwgbnVsbFxufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT05GSUc6IFBvc3RSZWVsc0NvbmZpZyA9IHtcbiAgYXBpVXJsOiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcbiAgbWluaW9FbmRwb2ludDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMCcsXG4gIG1pbmlvQWNjZXNzS2V5OiAnbWluaW9hZG1pbicsXG4gIG1pbmlvU2VjcmV0S2V5OiAnbWluaW9hZG1pbicsXG4gIG1pbmlvQnVja2V0OiAncG9zdHJlZWxzLWRvd25sb2FkcycsXG4gIGNvbmN1cnJlbmN5OiAzLFxuICBzY3JvbGxEZWxheTogMTUwMCxcbiAgbWF4U2Nyb2xsczogNTAsXG4gIG1heERvd25sb2FkczogMjAsXG59XG4iLCJpbXBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kJ1xuaW1wb3J0IHsgRG93bmxvYWRNYW5hZ2VyIH0gZnJvbSAnLi4vc3JjL2xpYi9kb3dubG9hZGVyJ1xuaW1wb3J0IHsgREVGQVVMVF9DT05GSUcsIHR5cGUgRG93bmxvYWRUYXNrLCB0eXBlIE5pY2hlLCB0eXBlIFBlbmRpbmdEb3dubG9hZCwgdHlwZSBQcm9maWxlSW5mbyB9IGZyb20gJy4uL3NyYy9saWIvdHlwZXMnXG5cbmxldCBkb3dubG9hZE1hbmFnZXI6IERvd25sb2FkTWFuYWdlciB8IG51bGwgPSBudWxsXG5sZXQgdGFza3M6IERvd25sb2FkVGFza1tdID0gW11cbmxldCBjdXJyZW50TmljaGVzOiBOaWNoZVtdID0gW11cbmxldCBwZW5kaW5nRG93bmxvYWQ6IFBlbmRpbmdEb3dubG9hZCB8IG51bGwgPSBudWxsXG5cbmFzeW5jIGZ1bmN0aW9uIGdldENvbmZpZygpIHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoJ3Bvc3RyZWVsc0NvbmZpZycpXG4gIHJldHVybiB7IC4uLkRFRkFVTFRfQ09ORklHLCAuLi5yZXN1bHQucG9zdHJlZWxzQ29uZmlnIH1cbn1cblxuZnVuY3Rpb24gYnJvYWRjYXN0VG9Qb3B1cChtZXNzYWdlOiBhbnkpIHtcbiAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBFbnZpYW5kbyBwYXJhIHBvcHVwOicsIG1lc3NhZ2UudHlwZSlcbiAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UobWVzc2FnZSkuY2F0Y2goKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gUG9wdXAgbsOjbyBlc3TDoSBhYmVydG8nKVxuICB9KVxufVxuXG5mdW5jdGlvbiBicm9hZGNhc3RUYXNrcygpIHtcbiAgYnJvYWRjYXN0VG9Qb3B1cCh7IHR5cGU6ICdUQVNLU19VUERBVEVEJywgcGF5bG9hZDogdGFza3MgfSlcbn1cblxuYXN5bmMgZnVuY3Rpb24gc3RhcnREb3dubG9hZHMoc2hvcnRjb2Rlczogc3RyaW5nW10sIHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiwgbmljaGVJZDogc3RyaW5nLCBwcm9maWxlPzogUHJvZmlsZUluZm8sIHBsYXRmb3JtOiAnSU5TVEFHUkFNJyB8ICdGQUNFQk9PSycgfCAnWU9VVFVCRScgPSAnSU5TVEFHUkFNJykge1xuICBjb25zdCBjb25maWcgPSBhd2FpdCBnZXRDb25maWcoKVxuICBjb25zdCBsaW1pdCA9IGNvbmZpZy5tYXhEb3dubG9hZHMgfHwgc2hvcnRjb2Rlcy5sZW5ndGhcbiAgY29uc3QgdG9Eb3dubG9hZCA9IHNob3J0Y29kZXMuc2xpY2UoMCwgbGltaXQpXG5cbiAgY29uc3QgbmV3VGFza3M6IERvd25sb2FkVGFza1tdID0gdG9Eb3dubG9hZC5tYXAoc2MgPT4gKHtcbiAgICBpZDogY3J5cHRvLnJhbmRvbVVVSUQoKSxcbiAgICBzaG9ydGNvZGU6IHNjLFxuICAgIHZpZGVvVXJsOiB2aWRlb1VybHNbc2NdIHx8IGBodHRwczovL3d3dy4ke3BsYXRmb3JtLnRvTG93ZXJDYXNlKCl9LmNvbS8ke3BsYXRmb3JtID09PSAnWU9VVFVCRScgPyAnc2hvcnRzJyA6ICdyZWVsJ30vJHtzY30vYCxcbiAgICBuaWNoZUlkLFxuICAgIHBsYXRmb3JtLFxuICAgIHN0YXR1czogJ3F1ZXVlZCcsXG4gICAgcHJvZ3Jlc3M6IDAsXG4gICAgY3JlYXRlZEF0OiBEYXRlLm5vdygpLFxuICB9KSlcblxuICB0YXNrcy5wdXNoKC4uLm5ld1Rhc2tzKVxuICBjb25zb2xlLmxvZygnW0JhY2tncm91bmRdIFRhcmVmYXMgY3JpYWRhczonLCBuZXdUYXNrcy5sZW5ndGgpXG4gIGJyb2FkY2FzdFRhc2tzKClcblxuICBkb3dubG9hZE1hbmFnZXIgPSBuZXcgRG93bmxvYWRNYW5hZ2VyKGNvbmZpZywgKHVwZGF0ZWRUYXNrKSA9PiB7XG4gICAgY29uc3QgaWR4ID0gdGFza3MuZmluZEluZGV4KHQgPT4gdC5pZCA9PT0gdXBkYXRlZFRhc2suaWQpXG4gICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgIHRhc2tzW2lkeF0gPSB7IC4uLnVwZGF0ZWRUYXNrIH1cbiAgICAgIGJyb2FkY2FzdFRhc2tzKClcbiAgICB9XG4gIH0pXG5cbiAgZG93bmxvYWRNYW5hZ2VyLmFkZFRhc2tzKG5ld1Rhc2tzLCBwcm9maWxlKVxufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBJbmljaWFkbycpXG5cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlOiBhbnksIHNlbmRlcjogYW55LCBzZW5kUmVzcG9uc2U6IGFueSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gTWVuc2FnZW06JywgbWVzc2FnZS50eXBlKVxuXG4gICAgc3dpdGNoIChtZXNzYWdlLnR5cGUpIHtcbiAgICAgIGNhc2UgJ0RPV05MT0FEX1JFRUxTJzoge1xuICAgICAgICBjb25zdCB7IHNob3J0Y29kZXMsIHZpZGVvVXJscywgbmljaGVzLCBwcm9maWxlVXJsLCBwcm9maWxlLCBwbGF0Zm9ybSA9ICdJTlNUQUdSQU0nIH0gPSBtZXNzYWdlLnBheWxvYWRcbiAgICAgICAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBSZWNlYmlkbyBET1dOTE9BRF9SRUVMUzonLCBzaG9ydGNvZGVzLmxlbmd0aCwgJ3bDrWRlb3MnKVxuICAgICAgICBjdXJyZW50TmljaGVzID0gbmljaGVzIHx8IFtdXG4gICAgICAgIHBlbmRpbmdEb3dubG9hZCA9IHsgc2hvcnRjb2RlcywgdmlkZW9VcmxzLCBuaWNoZXM6IG5pY2hlcyB8fCBbXSwgcHJvZmlsZVVybCwgcHJvZmlsZSwgcGxhdGZvcm0gfVxuXG4gICAgICAgIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogU3RyaW5nKHNob3J0Y29kZXMubGVuZ3RoKSB9KVxuICAgICAgICBjaHJvbWUuYWN0aW9uLnNldEJhZGdlQmFja2dyb3VuZENvbG9yKHsgY29sb3I6ICcjMDA5NWY2JyB9KVxuXG4gICAgICAgIGJyb2FkY2FzdFRvUG9wdXAoe1xuICAgICAgICAgIHR5cGU6ICdQRU5ESU5HX0RPV05MT0FEX1VQREFURUQnLFxuICAgICAgICAgIHBheWxvYWQ6IHBlbmRpbmdEb3dubG9hZFxuICAgICAgICB9KVxuXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ1NUQVJUX0RPV05MT0FEJzoge1xuICAgICAgICBjb25zdCB7IHNob3J0Y29kZXMsIHZpZGVvVXJscywgbmljaGVJZCwgcHJvZmlsZSwgcGxhdGZvcm0gPSAnSU5TVEFHUkFNJyB9ID0gbWVzc2FnZS5wYXlsb2FkXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gSW5pY2lhbmRvIGRvd25sb2FkIGRlJywgc2hvcnRjb2Rlcy5sZW5ndGgsICd2w61kZW9zJylcbiAgICAgICAgcGVuZGluZ0Rvd25sb2FkID0gbnVsbFxuICAgICAgICBjaHJvbWUuYWN0aW9uLnNldEJhZGdlVGV4dCh7IHRleHQ6ICcnIH0pXG4gICAgICAgIHN0YXJ0RG93bmxvYWRzKHNob3J0Y29kZXMsIHZpZGVvVXJscywgbmljaGVJZCwgcHJvZmlsZSwgcGxhdGZvcm0pXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ0dFVF9QRU5ESU5HX0RPV05MT0FEJzoge1xuICAgICAgICBjb25zb2xlLmxvZygnW0JhY2tncm91bmRdIEdFVF9QRU5ESU5HX0RPV05MT0FEIC0nLCAhIXBlbmRpbmdEb3dubG9hZCA/ICd0ZW0nIDogJ3ZhemlvJylcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcGVuZGluZ0Rvd25sb2FkIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBjYXNlICdHRVRfVEFTS1MnOiB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gR0VUX1RBU0tTIC0nLCB0YXNrcy5sZW5ndGgsICd0YXJlZmFzJylcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogdGFza3MgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ0NBTkNFTF9UQVNLJzoge1xuICAgICAgICBjb25zdCB7IGlkIH0gPSBtZXNzYWdlLnBheWxvYWRcbiAgICAgICAgZG93bmxvYWRNYW5hZ2VyPy5jYW5jZWxUYXNrKGlkKVxuICAgICAgICB0YXNrcyA9IHRhc2tzLmZpbHRlcih0ID0+IHQuaWQgIT09IGlkKVxuICAgICAgICBicm9hZGNhc3RUYXNrcygpXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSlcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ0NBTkNFTF9BTEwnOiB7XG4gICAgICAgIGRvd25sb2FkTWFuYWdlcj8uY2FuY2VsQWxsKClcbiAgICAgICAgdGFza3MgPSB0YXNrcy5maWx0ZXIodCA9PiB0LnN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcgfHwgdC5zdGF0dXMgPT09ICdlcnJvcicpXG4gICAgICAgIGJyb2FkY2FzdFRhc2tzKClcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9KVxuICAgICAgICBicmVha1xuICAgICAgfVxuICAgICAgY2FzZSAnQ0xFQVJfQ09NUExFVEVEJzoge1xuICAgICAgICB0YXNrcyA9IHRhc2tzLmZpbHRlcih0ID0+IHQuc3RhdHVzID09PSAncXVldWVkJyB8fCB0LnN0YXR1cyA9PT0gJ2Rvd25sb2FkaW5nJylcbiAgICAgICAgYnJvYWRjYXN0VGFza3MoKVxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBjYXNlICdHRVRfTklDSEVTJzoge1xuICAgICAgICBpZiAoIWN1cnJlbnROaWNoZXMgfHwgY3VycmVudE5pY2hlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBmZXRjaCgnaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS9uaWNob3MnKVxuICAgICAgICAgICAgLnRoZW4ocmVzID0+IHJlcy5qc29uKCkpXG4gICAgICAgICAgICAudGhlbihkYXRhID0+IHtcbiAgICAgICAgICAgICAgaWYgKGRhdGEuc3VjY2VzcyAmJiBkYXRhLmRhdGEpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50TmljaGVzID0gZGF0YS5kYXRhXG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogY3VycmVudE5pY2hlcyB9KVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IFtdIH0pXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW0JhY2tncm91bmRdIEVycm8gYW8gY2FycmVnYXIgbmljaG9zOicsIGVycilcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogW10gfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBjdXJyZW50TmljaGVzIH0pXG4gICAgICAgIH1cbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGNhc2UgJ0dFVF9DT05GSUcnOiB7XG4gICAgICAgIGdldENvbmZpZygpLnRoZW4oY29uZmlnID0+IHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGNvbmZpZyB9KSlcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIGNhc2UgJ1NBVkVfQ09ORklHJzoge1xuICAgICAgICBnZXRDb25maWcoKS50aGVuKGN1cnJlbnRDb25maWcgPT4ge1xuICAgICAgICAgIGNvbnN0IHVwZGF0ZWRDb25maWcgPSB7IC4uLmN1cnJlbnRDb25maWcsIC4uLm1lc3NhZ2UucGF5bG9hZCB9XG4gICAgICAgICAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBTYWx2YW5kbyBjb25maWc6JywgdXBkYXRlZENvbmZpZylcbiAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5zeW5jLnNldCh7IHBvc3RyZWVsc0NvbmZpZzogdXBkYXRlZENvbmZpZyB9LCAoKSA9PiB7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB1cGRhdGVkQ29uZmlnIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1Vua25vd24gdHlwZScgfSlcbiAgICB9XG4gIH0pXG59KVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsIi8vI3JlZ2lvbiBzcmMvaW5kZXgudHNcbi8qKlxuKiBDbGFzcyBmb3IgcGFyc2luZyBhbmQgcGVyZm9ybWluZyBvcGVyYXRpb25zIG9uIG1hdGNoIHBhdHRlcm5zLlxuKlxuKiBAZXhhbXBsZVxuKiAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgTWF0Y2hQYXR0ZXJuKCcqOi8vZ29vZ2xlLmNvbS8qJyk7XG4qXG4qICAgcGF0dGVybi5pbmNsdWRlcygnaHR0cHM6Ly9nb29nbGUuY29tJyk7IC8vIHRydWVcbiogICBwYXR0ZXJuLmluY2x1ZGVzKCdodHRwOi8veW91dHViZS5jb20vd2F0Y2g/dj0xMjMnKTsgLy8gZmFsc2VcbiovXG52YXIgTWF0Y2hQYXR0ZXJuID0gY2xhc3MgTWF0Y2hQYXR0ZXJuIHtcblx0c3RhdGljIHtcblx0XHR0aGlzLlBST1RPQ09MUyA9IFtcblx0XHRcdFwiaHR0cFwiLFxuXHRcdFx0XCJodHRwc1wiLFxuXHRcdFx0XCJmaWxlXCIsXG5cdFx0XHRcImZ0cFwiLFxuXHRcdFx0XCJ1cm5cIixcblx0XHRcdFwid3NcIixcblx0XHRcdFwid3NzXCJcblx0XHRdO1xuXHR9XG5cdC8qKlxuXHQqIFBhcnNlIGEgbWF0Y2ggcGF0dGVybiBzdHJpbmcuIElmIGl0IGlzIGludmFsaWQsIHRoZSBjb25zdHJ1Y3RvciB3aWxsIHRocm93IGFuXG5cdCogYEludmFsaWRNYXRjaFBhdHRlcm5gIGVycm9yLlxuXHQqXG5cdCogQHBhcmFtIG1hdGNoUGF0dGVybiBUaGUgbWF0Y2ggcGF0dGVybiB0byBwYXJzZS5cblx0Ki9cblx0Y29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG5cdFx0aWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcblx0XHRcdHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLk1hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuXHRcdFx0dGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG5cdFx0XHR0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG5cdFx0XHRpZiAoZ3JvdXBzID09IG51bGwpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuXHRcdFx0Y29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuXHRcdFx0dmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcblx0XHRcdHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG5cdFx0XHR0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG5cdFx0XHR0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcblx0XHRcdHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuXHRcdH1cblx0fVxuXHQvKiogQ2hlY2sgaWYgYSBVUkwgaXMgaW5jbHVkZWQgaW4gYSBwYXR0ZXJuLiAqL1xuXHRpbmNsdWRlcyh1cmwpIHtcblx0XHRjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG5cdFx0aWYgKHRoaXMuaXNBbGxVcmxzKSByZXR1cm4gIXRoaXMuaXNVbmtub3duUHJvdG9jb2wodSk7XG5cdFx0cmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcImZ0cFwiKSByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcInVyblwiKSByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuXHRcdH0pO1xuXHR9XG5cdGlzSHR0cE1hdGNoKHVybCkge1xuXHRcdHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuXHR9XG5cdGlzSHR0cHNNYXRjaCh1cmwpIHtcblx0XHRyZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG5cdH1cblx0aXNIb3N0UGF0aE1hdGNoKHVybCkge1xuXHRcdGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpIHJldHVybiBmYWxzZTtcblx0XHRjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW3RoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXTtcblx0XHRjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuXHRcdHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcblx0fVxuXHRpc1Vua25vd25Qcm90b2NvbCh1cmwpIHtcblx0XHRyZXR1cm4gIXRoaXMucHJvdG9jb2xNYXRjaGVzLmluY2x1ZGVzKHVybC5wcm90b2NvbC5zbGljZSgwLCAtMSkpO1xuXHR9XG5cdGlzUGF0aE1hdGNoKHVybCkge1xuXHRcdGlmICghdGhpcy5wYXRobmFtZU1hdGNoKSByZXR1cm4gZmFsc2U7XG5cdFx0cmV0dXJuIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCkudGVzdCh1cmwucGF0aG5hbWUpO1xuXHR9XG5cdGlzRmlsZU1hdGNoKHVybCkge1xuXHRcdHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiZmlsZTpcIiAmJiB0aGlzLmlzUGF0aE1hdGNoKHVybCk7XG5cdH1cblx0aXNGdHBNYXRjaChfdXJsKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG5cdH1cblx0aXNVcm5NYXRjaChfdXJsKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG5cdH1cblx0Y29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcblx0XHRjb25zdCBzdGFyc1JlcGxhY2VkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKS5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG5cdFx0cmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG5cdH1cblx0ZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG5cdH1cbn07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuXHRcdHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG5cdH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcblx0aWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuXHRpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKSB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcblx0aWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgKTtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgSW52YWxpZE1hdGNoUGF0dGVybiwgTWF0Y2hQYXR0ZXJuIH07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNCw1LDZdLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLGlCQUFpQixLQUFLO0VBQzlCLElBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxZQUFZLE9BQU8sRUFBRSxNQUFNLElBQUk7RUFDakUsT0FBTztDQUNSOzs7Q0NBQSxJQUFhLGtCQUFiLE1BQTZCO0VBQzNCLFFBQWdDLENBQUM7RUFDakMseUJBQWlCLElBQUksSUFBNkI7RUFDbEQ7RUFDQTtFQUNBLFVBQWtCO0VBQ2xCLFVBQXNDO0VBRXRDLFlBQVksUUFBeUIsVUFBd0I7R0FDM0QsS0FBSyxTQUFTO0dBQ2QsS0FBSyxXQUFXO0VBQ2xCO0VBRUEsU0FBUyxPQUF1QixTQUF1QjtHQUNyRCxJQUFJLFNBQVMsS0FBSyxVQUFVO0dBQzVCLEtBQUssTUFBTSxLQUFLLEdBQUcsS0FBSztHQUN4QixLQUFLLGFBQWE7RUFDcEI7RUFFQSxNQUFjLGVBQWU7R0FDM0IsT0FBTyxLQUFLLFVBQVUsS0FBSyxPQUFPLGVBQWUsS0FBSyxNQUFNLFNBQVMsR0FBRztJQUN0RSxNQUFNLE9BQU8sS0FBSyxNQUFNLE1BQU07SUFDOUIsSUFBSSxDQUFDLE1BQU07SUFDWCxLQUFLO0lBQ0wsS0FBSyxhQUFhLElBQUksQ0FBQyxDQUFDLGNBQWM7S0FDcEMsS0FBSztLQUNMLEtBQUssYUFBYTtJQUNwQixDQUFDO0dBQ0g7RUFDRjtFQUVBLE1BQWMsYUFBYSxNQUFvQjtHQUM3QyxNQUFNLGFBQWEsSUFBSSxnQkFBZ0I7R0FDdkMsS0FBSyxPQUFPLElBQUksS0FBSyxJQUFJLFVBQVU7R0FFbkMsSUFBSTtJQUNGLFFBQVEsSUFBSSxvQ0FBb0MsS0FBSyxTQUFTO0lBQzlELEtBQUssU0FBUztJQUNkLEtBQUssU0FBUyxJQUFJ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