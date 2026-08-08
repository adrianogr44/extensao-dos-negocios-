var background = (function() {
	//#region ../../node_modules/.pnpm/wxt@0.20.27_@types+node@20._fa6deffb0f1d5d40bb94ddf3a752a3a0/node_modules/wxt/dist/utils/define-background.mjs
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
	async function startDownloads(shortcodes, videoUrls, nicheId, profile, platform = "INSTAGRAM", redownload = false) {
		const config = await getConfig();
		let filteredShortcodes = shortcodes;
		if (!redownload) try {
			const data = await (await fetch(`${config.apiUrl}/api/videos/check-existing`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					shortcodes,
					nicheId,
					platform
				})
			})).json();
			if (data.success && data.data?.existing?.length) {
				const existingSet = new Set(data.data.existing);
				filteredShortcodes = shortcodes.filter((sc) => !existingSet.has(sc));
				const skipped = shortcodes.length - filteredShortcodes.length;
				if (skipped > 0) console.log(`[Background] Pulando ${skipped} vídeos já existentes na base`);
			}
		} catch (err) {
			console.error("[Background] Erro ao verificar vídeos existentes:", err);
		}
		if (filteredShortcodes.length === 0) {
			console.log("[Background] Nenhum vídeo novo para baixar");
			broadcastTasks();
			return;
		}
		const limit = config.maxDownloads || filteredShortcodes.length;
		const newTasks = filteredShortcodes.slice(0, limit).map((sc) => ({
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
					const { shortcodes, videoUrls, nicheId, profile, platform = "INSTAGRAM", redownload = false } = message.payload;
					console.log("[Background] Iniciando download de", shortcodes.length, "vídeos");
					pendingDownload = null;
					chrome.action.setBadgeText({ text: "" });
					startDownloads(shortcodes, videoUrls, nicheId, profile, platform, redownload);
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
	//#region \0virtual:wxt-background-entrypoint?C:/Users/adria/Desktop/postreels-v2/apps/extension/entrypoints/background.ts
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsIm5hbWVzIjpbImJyb3dzZXIiXSwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtYmFja2dyb3VuZC5tanMiLCIuLi8uLi9zcmMvbGliL2Rvd25sb2FkZXIudHMiLCIuLi8uLi9zcmMvbGliL3R5cGVzLnRzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC50cyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMi4yL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMjdfQHR5cGVzK25vZGVAMjAuX2ZhNmRlZmZiMGYxZDVkNDBiYjk0ZGRmM2E3NTJhM2EwL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMS4xLjAvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXgubWpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvdXRpbHMvZGVmaW5lLWJhY2tncm91bmQudHNcbmZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG5cdGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuXHRyZXR1cm4gYXJnO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH07XG4iLCJpbXBvcnQgdHlwZSB7IERvd25sb2FkVGFzaywgUG9zdFJlZWxzQ29uZmlnLCBQcm9maWxlSW5mbyB9IGZyb20gJy4vdHlwZXMnXHJcblxyXG50eXBlIFRhc2tDYWxsYmFjayA9ICh0YXNrOiBEb3dubG9hZFRhc2spID0+IHZvaWRcclxuXHJcbmV4cG9ydCBjbGFzcyBEb3dubG9hZE1hbmFnZXIge1xyXG4gIHByaXZhdGUgcXVldWU6IERvd25sb2FkVGFza1tdID0gW11cclxuICBwcml2YXRlIGFjdGl2ZSA9IG5ldyBNYXA8c3RyaW5nLCBBYm9ydENvbnRyb2xsZXI+KClcclxuICBwcml2YXRlIGNvbmZpZzogUG9zdFJlZWxzQ29uZmlnXHJcbiAgcHJpdmF0ZSBvblVwZGF0ZTogVGFza0NhbGxiYWNrXHJcbiAgcHJpdmF0ZSBydW5uaW5nID0gMFxyXG4gIHByaXZhdGUgcHJvZmlsZTogUHJvZmlsZUluZm8gfCBudWxsID0gbnVsbFxyXG5cclxuICBjb25zdHJ1Y3Rvcihjb25maWc6IFBvc3RSZWVsc0NvbmZpZywgb25VcGRhdGU6IFRhc2tDYWxsYmFjaykge1xyXG4gICAgdGhpcy5jb25maWcgPSBjb25maWdcclxuICAgIHRoaXMub25VcGRhdGUgPSBvblVwZGF0ZVxyXG4gIH1cclxuXHJcbiAgYWRkVGFza3ModGFza3M6IERvd25sb2FkVGFza1tdLCBwcm9maWxlPzogUHJvZmlsZUluZm8pIHtcclxuICAgIGlmIChwcm9maWxlKSB0aGlzLnByb2ZpbGUgPSBwcm9maWxlXHJcbiAgICB0aGlzLnF1ZXVlLnB1c2goLi4udGFza3MpXHJcbiAgICB0aGlzLnByb2Nlc3NRdWV1ZSgpXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NRdWV1ZSgpIHtcclxuICAgIHdoaWxlICh0aGlzLnJ1bm5pbmcgPCB0aGlzLmNvbmZpZy5jb25jdXJyZW5jeSAmJiB0aGlzLnF1ZXVlLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgdGFzayA9IHRoaXMucXVldWUuc2hpZnQoKVxyXG4gICAgICBpZiAoIXRhc2spIGJyZWFrXHJcbiAgICAgIHRoaXMucnVubmluZysrXHJcbiAgICAgIHRoaXMuZG93bmxvYWRUYXNrKHRhc2spLmZpbmFsbHkoKCkgPT4ge1xyXG4gICAgICAgIHRoaXMucnVubmluZy0tXHJcbiAgICAgICAgdGhpcy5wcm9jZXNzUXVldWUoKVxyXG4gICAgICB9KVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBkb3dubG9hZFRhc2sodGFzazogRG93bmxvYWRUYXNrKSB7XHJcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpXHJcbiAgICB0aGlzLmFjdGl2ZS5zZXQodGFzay5pZCwgY29udHJvbGxlcilcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zb2xlLmxvZygnW0Rvd25sb2FkZXJdIEluaWNpYW5kbyBkb3dubG9hZDonLCB0YXNrLnNob3J0Y29kZSlcclxuICAgICAgdGFzay5zdGF0dXMgPSAnZG93bmxvYWRpbmcnXHJcbiAgICAgIHRoaXMub25VcGRhdGUodGFzaylcclxuXHJcbiAgICAgIGNvbnN0IHBsYXRmb3JtID0gdGFzay5wbGF0Zm9ybSB8fCAnSU5TVEFHUkFNJ1xyXG4gICAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmNvbmZpZy5hcGlVcmx9L2FwaS92aWRlb3MvZG93bmxvYWRgXHJcbiAgICAgIGNvbnNvbGUubG9nKCdbRG93bmxvYWRlcl0gQ2hhbWFuZG8gZW5kcG9pbnQ6JywgdXJsKVxyXG5cclxuICAgICAgY29uc3QgYm9keTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XHJcbiAgICAgICAgc2hvcnRjb2RlOiB0YXNrLnNob3J0Y29kZSxcclxuICAgICAgICBuaWNoZUlkOiB0YXNrLm5pY2hlSWQsXHJcbiAgICAgICAgcGxhdGZvcm0sXHJcbiAgICAgIH1cclxuICAgICAgaWYgKHRoaXMucHJvZmlsZSkgYm9keS5wcm9maWxlID0gdGhpcy5wcm9maWxlXHJcblxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgIHNpZ25hbDogY29udHJvbGxlci5zaWduYWwsXHJcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSksXHJcbiAgICAgIH0pXHJcblxyXG4gICAgICBjb25zb2xlLmxvZygnW0Rvd25sb2FkZXJdIFJlc3Bvc3RhIHJlY2ViaWRhOicsIHJlc3BvbnNlLnN0YXR1cywgcmVzcG9uc2Uuc3RhdHVzVGV4dClcclxuXHJcbiAgICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvci5lcnJvciB8fCBgSFRUUCAke3Jlc3BvbnNlLnN0YXR1c31gKVxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXHJcbiAgICAgIGNvbnNvbGUubG9nKCdbRG93bmxvYWRlcl0gRG93bmxvYWQgY29uY2x1w61kbzonLCB0YXNrLnNob3J0Y29kZSlcclxuICAgICAgdGFzay5maWxlbmFtZSA9IGRhdGEuZGF0YS5maWxlbmFtZVxyXG4gICAgICB0YXNrLnN0YXR1cyA9ICdjb21wbGV0ZWQnXHJcbiAgICAgIHRhc2sucHJvZ3Jlc3MgPSAxMDBcclxuICAgICAgdGhpcy5vblVwZGF0ZSh0YXNrKVxyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnN0IGVyck1zZyA9IChlcnIgYXMgRXJyb3IpLm1lc3NhZ2VcclxuICAgICAgY29uc29sZS5lcnJvcignW0Rvd25sb2FkZXJdIEVycm86JywgZXJyTXNnKVxyXG4gICAgICBpZiAoKGVyciBhcyBFcnJvcikubmFtZSA9PT0gJ0Fib3J0RXJyb3InKSByZXR1cm5cclxuICAgICAgdGFzay5zdGF0dXMgPSAnZXJyb3InXHJcbiAgICAgIHRhc2suZXJyb3IgPSBlcnJNc2dcclxuICAgICAgdGhpcy5vblVwZGF0ZSh0YXNrKVxyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgdGhpcy5hY3RpdmUuZGVsZXRlKHRhc2suaWQpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuXHJcbiAgY2FuY2VsVGFzayhpZDogc3RyaW5nKSB7XHJcbiAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5hY3RpdmUuZ2V0KGlkKVxyXG4gICAgaWYgKGNvbnRyb2xsZXIpIHtcclxuICAgICAgY29udHJvbGxlci5hYm9ydCgpXHJcbiAgICAgIHRoaXMuYWN0aXZlLmRlbGV0ZShpZClcclxuICAgIH1cclxuICAgIHRoaXMucXVldWUgPSB0aGlzLnF1ZXVlLmZpbHRlcih0ID0+IHQuaWQgIT09IGlkKVxyXG4gIH1cclxuXHJcbiAgY2FuY2VsQWxsKCkge1xyXG4gICAgdGhpcy5hY3RpdmUuZm9yRWFjaChjID0+IGMuYWJvcnQoKSlcclxuICAgIHRoaXMuYWN0aXZlLmNsZWFyKClcclxuICAgIHRoaXMucXVldWUgPSBbXVxyXG4gIH1cclxufVxyXG4iLCJleHBvcnQgaW50ZXJmYWNlIFBvc3RSZWVsc0NvbmZpZyB7XHJcbiAgYXBpVXJsOiBzdHJpbmdcclxuICBtaW5pb0VuZHBvaW50OiBzdHJpbmdcclxuICBtaW5pb0FjY2Vzc0tleTogc3RyaW5nXHJcbiAgbWluaW9TZWNyZXRLZXk6IHN0cmluZ1xyXG4gIG1pbmlvQnVja2V0OiBzdHJpbmdcclxuICBjb25jdXJyZW5jeTogbnVtYmVyXHJcbiAgc2Nyb2xsRGVsYXk6IG51bWJlclxyXG4gIG1heFNjcm9sbHM6IG51bWJlclxyXG4gIG1heERvd25sb2FkczogbnVtYmVyXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUHJvZmlsZUluZm8ge1xyXG4gIHVzZXJuYW1lOiBzdHJpbmdcclxuICBmdWxsTmFtZTogc3RyaW5nXHJcbiAgYXZhdGFyVXJsPzogc3RyaW5nXHJcbiAgcG9zdHNDb3VudD86IG51bWJlclxyXG4gIGZvbGxvd2Vyc0NvdW50PzogbnVtYmVyXHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGVuZGluZ0Rvd25sb2FkIHtcclxuICBzaG9ydGNvZGVzOiBzdHJpbmdbXVxyXG4gIHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxyXG4gIG5pY2hlczogTmljaGVbXVxyXG4gIHByb2ZpbGVVcmw6IHN0cmluZ1xyXG4gIHByb2ZpbGU/OiBQcm9maWxlSW5mb1xyXG4gIHBsYXRmb3JtOiBQbGF0Zm9ybVxyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFJlZWxJbmZvIHtcclxuICBzaG9ydGNvZGU6IHN0cmluZ1xyXG4gIHZpZGVvVXJsOiBzdHJpbmdcclxuICB0aHVtYm5haWxVcmw/OiBzdHJpbmdcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgUGxhdGZvcm0gPSAnSU5TVEFHUkFNJyB8ICdGQUNFQk9PSycgfCAnWU9VVFVCRSdcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRG93bmxvYWRUYXNrIHtcclxuICBpZDogc3RyaW5nXHJcbiAgc2hvcnRjb2RlOiBzdHJpbmdcclxuICB2aWRlb1VybDogc3RyaW5nXHJcbiAgbmljaGVJZDogc3RyaW5nXHJcbiAgcGxhdGZvcm06IFBsYXRmb3JtXHJcbiAgc3RhdHVzOiAncXVldWVkJyB8ICdkb3dubG9hZGluZycgfCAndXBsb2FkaW5nJyB8ICdjb21wbGV0ZWQnIHwgJ2Vycm9yJ1xyXG4gIHByb2dyZXNzOiBudW1iZXJcclxuICBlcnJvcj86IHN0cmluZ1xyXG4gIGZpbGVuYW1lPzogc3RyaW5nXHJcbiAgY3JlYXRlZEF0OiBudW1iZXJcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBOaWNoZSB7XHJcbiAgaWQ6IHN0cmluZ1xyXG4gIG5vbWU6IHN0cmluZ1xyXG4gIGNvcjogc3RyaW5nIHwgbnVsbFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT05GSUc6IFBvc3RSZWVsc0NvbmZpZyA9IHtcclxuICBhcGlVcmw6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxyXG4gIG1pbmlvRW5kcG9pbnQ6ICdodHRwOi8vbG9jYWxob3N0OjkwMDAnLFxyXG4gIG1pbmlvQWNjZXNzS2V5OiAnbWluaW9hZG1pbicsXHJcbiAgbWluaW9TZWNyZXRLZXk6ICdtaW5pb2FkbWluJyxcclxuICBtaW5pb0J1Y2tldDogJ3Bvc3RyZWVscy1kb3dubG9hZHMnLFxyXG4gIGNvbmN1cnJlbmN5OiAzLFxyXG4gIHNjcm9sbERlbGF5OiAxNTAwLFxyXG4gIG1heFNjcm9sbHM6IDUwLFxyXG4gIG1heERvd25sb2FkczogMjAsXHJcbn1cclxuIiwiaW1wb3J0IHsgZGVmaW5lQmFja2dyb3VuZCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtYmFja2dyb3VuZCdcclxuaW1wb3J0IHsgRG93bmxvYWRNYW5hZ2VyIH0gZnJvbSAnLi4vc3JjL2xpYi9kb3dubG9hZGVyJ1xyXG5pbXBvcnQgeyBERUZBVUxUX0NPTkZJRywgdHlwZSBEb3dubG9hZFRhc2ssIHR5cGUgTmljaGUsIHR5cGUgUGVuZGluZ0Rvd25sb2FkLCB0eXBlIFByb2ZpbGVJbmZvIH0gZnJvbSAnLi4vc3JjL2xpYi90eXBlcydcclxuXHJcbmxldCBkb3dubG9hZE1hbmFnZXI6IERvd25sb2FkTWFuYWdlciB8IG51bGwgPSBudWxsXHJcbmxldCB0YXNrczogRG93bmxvYWRUYXNrW10gPSBbXVxyXG5sZXQgY3VycmVudE5pY2hlczogTmljaGVbXSA9IFtdXHJcbmxldCBwZW5kaW5nRG93bmxvYWQ6IFBlbmRpbmdEb3dubG9hZCB8IG51bGwgPSBudWxsXHJcblxyXG5hc3luYyBmdW5jdGlvbiBnZXRDb25maWcoKSB7XHJcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoJ3Bvc3RyZWVsc0NvbmZpZycpXHJcbiAgcmV0dXJuIHsgLi4uREVGQVVMVF9DT05GSUcsIC4uLnJlc3VsdC5wb3N0cmVlbHNDb25maWcgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBicm9hZGNhc3RUb1BvcHVwKG1lc3NhZ2U6IGFueSkge1xyXG4gIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gRW52aWFuZG8gcGFyYSBwb3B1cDonLCBtZXNzYWdlLnR5cGUpXHJcbiAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UobWVzc2FnZSkuY2F0Y2goKCkgPT4ge1xyXG4gICAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBQb3B1cCBuw6NvIGVzdMOhIGFiZXJ0bycpXHJcbiAgfSlcclxufVxyXG5cclxuZnVuY3Rpb24gYnJvYWRjYXN0VGFza3MoKSB7XHJcbiAgYnJvYWRjYXN0VG9Qb3B1cCh7IHR5cGU6ICdUQVNLU19VUERBVEVEJywgcGF5bG9hZDogdGFza3MgfSlcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc3RhcnREb3dubG9hZHMoc2hvcnRjb2Rlczogc3RyaW5nW10sIHZpZGVvVXJsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiwgbmljaGVJZDogc3RyaW5nLCBwcm9maWxlPzogUHJvZmlsZUluZm8sIHBsYXRmb3JtOiAnSU5TVEFHUkFNJyB8ICdGQUNFQk9PSycgfCAnWU9VVFVCRScgPSAnSU5TVEFHUkFNJywgcmVkb3dubG9hZDogYm9vbGVhbiA9IGZhbHNlKSB7XHJcbiAgY29uc3QgY29uZmlnID0gYXdhaXQgZ2V0Q29uZmlnKClcclxuXHJcbiAgbGV0IGZpbHRlcmVkU2hvcnRjb2RlcyA9IHNob3J0Y29kZXNcclxuICBpZiAoIXJlZG93bmxvYWQpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2NvbmZpZy5hcGlVcmx9L2FwaS92aWRlb3MvY2hlY2stZXhpc3RpbmdgLCB7XHJcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXHJcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBzaG9ydGNvZGVzLCBuaWNoZUlkLCBwbGF0Zm9ybSB9KSxcclxuICAgICAgfSlcclxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlcy5qc29uKClcclxuICAgICAgaWYgKGRhdGEuc3VjY2VzcyAmJiBkYXRhLmRhdGE/LmV4aXN0aW5nPy5sZW5ndGgpIHtcclxuICAgICAgICBjb25zdCBleGlzdGluZ1NldCA9IG5ldyBTZXQ8c3RyaW5nPihkYXRhLmRhdGEuZXhpc3RpbmcpXHJcbiAgICAgICAgZmlsdGVyZWRTaG9ydGNvZGVzID0gc2hvcnRjb2Rlcy5maWx0ZXIoc2MgPT4gIWV4aXN0aW5nU2V0LmhhcyhzYykpXHJcbiAgICAgICAgY29uc3Qgc2tpcHBlZCA9IHNob3J0Y29kZXMubGVuZ3RoIC0gZmlsdGVyZWRTaG9ydGNvZGVzLmxlbmd0aFxyXG4gICAgICAgIGlmIChza2lwcGVkID4gMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtCYWNrZ3JvdW5kXSBQdWxhbmRvICR7c2tpcHBlZH0gdsOtZGVvcyBqw6EgZXhpc3RlbnRlcyBuYSBiYXNlYClcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdbQmFja2dyb3VuZF0gRXJybyBhbyB2ZXJpZmljYXIgdsOtZGVvcyBleGlzdGVudGVzOicsIGVycilcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGlmIChmaWx0ZXJlZFNob3J0Y29kZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICBjb25zb2xlLmxvZygnW0JhY2tncm91bmRdIE5lbmh1bSB2w61kZW8gbm92byBwYXJhIGJhaXhhcicpXHJcbiAgICBicm9hZGNhc3RUYXNrcygpXHJcbiAgICByZXR1cm5cclxuICB9XHJcblxyXG4gIGNvbnN0IGxpbWl0ID0gY29uZmlnLm1heERvd25sb2FkcyB8fCBmaWx0ZXJlZFNob3J0Y29kZXMubGVuZ3RoXHJcbiAgY29uc3QgdG9Eb3dubG9hZCA9IGZpbHRlcmVkU2hvcnRjb2Rlcy5zbGljZSgwLCBsaW1pdClcclxuXHJcbiAgY29uc3QgbmV3VGFza3M6IERvd25sb2FkVGFza1tdID0gdG9Eb3dubG9hZC5tYXAoc2MgPT4gKHtcclxuICAgIGlkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxyXG4gICAgc2hvcnRjb2RlOiBzYyxcclxuICAgIHZpZGVvVXJsOiB2aWRlb1VybHNbc2NdIHx8IGBodHRwczovL3d3dy4ke3BsYXRmb3JtLnRvTG93ZXJDYXNlKCl9LmNvbS8ke3BsYXRmb3JtID09PSAnWU9VVFVCRScgPyAnc2hvcnRzJyA6ICdyZWVsJ30vJHtzY30vYCxcclxuICAgIG5pY2hlSWQsXHJcbiAgICBwbGF0Zm9ybSxcclxuICAgIHN0YXR1czogJ3F1ZXVlZCcsXHJcbiAgICBwcm9ncmVzczogMCxcclxuICAgIGNyZWF0ZWRBdDogRGF0ZS5ub3coKSxcclxuICB9KSlcclxuXHJcbiAgdGFza3MucHVzaCguLi5uZXdUYXNrcylcclxuICBjb25zb2xlLmxvZygnW0JhY2tncm91bmRdIFRhcmVmYXMgY3JpYWRhczonLCBuZXdUYXNrcy5sZW5ndGgpXHJcbiAgYnJvYWRjYXN0VGFza3MoKVxyXG5cclxuICBkb3dubG9hZE1hbmFnZXIgPSBuZXcgRG93bmxvYWRNYW5hZ2VyKGNvbmZpZywgKHVwZGF0ZWRUYXNrKSA9PiB7XHJcbiAgICBjb25zdCBpZHggPSB0YXNrcy5maW5kSW5kZXgodCA9PiB0LmlkID09PSB1cGRhdGVkVGFzay5pZClcclxuICAgIGlmIChpZHggIT09IC0xKSB7XHJcbiAgICAgIHRhc2tzW2lkeF0gPSB7IC4uLnVwZGF0ZWRUYXNrIH1cclxuICAgICAgYnJvYWRjYXN0VGFza3MoKVxyXG4gICAgfVxyXG4gIH0pXHJcblxyXG4gIGRvd25sb2FkTWFuYWdlci5hZGRUYXNrcyhuZXdUYXNrcywgcHJvZmlsZSlcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XHJcbiAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBJbmljaWFkbycpXHJcblxyXG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZTogYW55LCBzZW5kZXI6IGFueSwgc2VuZFJlc3BvbnNlOiBhbnkpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gTWVuc2FnZW06JywgbWVzc2FnZS50eXBlKVxyXG5cclxuICAgIHN3aXRjaCAobWVzc2FnZS50eXBlKSB7XHJcbiAgICAgIGNhc2UgJ0RPV05MT0FEX1JFRUxTJzoge1xyXG4gICAgICAgIGNvbnN0IHsgc2hvcnRjb2RlcywgdmlkZW9VcmxzLCBuaWNoZXMsIHByb2ZpbGVVcmwsIHByb2ZpbGUsIHBsYXRmb3JtID0gJ0lOU1RBR1JBTScgfSA9IG1lc3NhZ2UucGF5bG9hZFxyXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gUmVjZWJpZG8gRE9XTkxPQURfUkVFTFM6Jywgc2hvcnRjb2Rlcy5sZW5ndGgsICd2w61kZW9zJylcclxuICAgICAgICBjdXJyZW50TmljaGVzID0gbmljaGVzIHx8IFtdXHJcbiAgICAgICAgcGVuZGluZ0Rvd25sb2FkID0geyBzaG9ydGNvZGVzLCB2aWRlb1VybHMsIG5pY2hlczogbmljaGVzIHx8IFtdLCBwcm9maWxlVXJsLCBwcm9maWxlLCBwbGF0Zm9ybSB9XHJcblxyXG4gICAgICAgIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogU3RyaW5nKHNob3J0Y29kZXMubGVuZ3RoKSB9KVxyXG4gICAgICAgIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VCYWNrZ3JvdW5kQ29sb3IoeyBjb2xvcjogJyMwMDk1ZjYnIH0pXHJcblxyXG4gICAgICAgIGJyb2FkY2FzdFRvUG9wdXAoe1xyXG4gICAgICAgICAgdHlwZTogJ1BFTkRJTkdfRE9XTkxPQURfVVBEQVRFRCcsXHJcbiAgICAgICAgICBwYXlsb2FkOiBwZW5kaW5nRG93bmxvYWRcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pXHJcbiAgICAgICAgYnJlYWtcclxuICAgICAgfVxyXG4gICAgICBjYXNlICdTVEFSVF9ET1dOTE9BRCc6IHtcclxuICAgICAgICBjb25zdCB7IHNob3J0Y29kZXMsIHZpZGVvVXJscywgbmljaGVJZCwgcHJvZmlsZSwgcGxhdGZvcm0gPSAnSU5TVEFHUkFNJywgcmVkb3dubG9hZCA9IGZhbHNlIH0gPSBtZXNzYWdlLnBheWxvYWRcclxuICAgICAgICBjb25zb2xlLmxvZygnW0JhY2tncm91bmRdIEluaWNpYW5kbyBkb3dubG9hZCBkZScsIHNob3J0Y29kZXMubGVuZ3RoLCAndsOtZGVvcycpXHJcbiAgICAgICAgcGVuZGluZ0Rvd25sb2FkID0gbnVsbFxyXG4gICAgICAgIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogJycgfSlcclxuICAgICAgICBzdGFydERvd25sb2FkcyhzaG9ydGNvZGVzLCB2aWRlb1VybHMsIG5pY2hlSWQsIHByb2ZpbGUsIHBsYXRmb3JtLCByZWRvd25sb2FkKVxyXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSlcclxuICAgICAgICBicmVha1xyXG4gICAgICB9XHJcbiAgICAgIGNhc2UgJ0dFVF9QRU5ESU5HX0RPV05MT0FEJzoge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gR0VUX1BFTkRJTkdfRE9XTkxPQUQgLScsICEhcGVuZGluZ0Rvd25sb2FkID8gJ3RlbScgOiAndmF6aW8nKVxyXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHBlbmRpbmdEb3dubG9hZCB9KVxyXG4gICAgICAgIGJyZWFrXHJcbiAgICAgIH1cclxuICAgICAgY2FzZSAnR0VUX1RBU0tTJzoge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQmFja2dyb3VuZF0gR0VUX1RBU0tTIC0nLCB0YXNrcy5sZW5ndGgsICd0YXJlZmFzJylcclxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB0YXNrcyB9KVxyXG4gICAgICAgIGJyZWFrXHJcbiAgICAgIH1cclxuICAgICAgY2FzZSAnQ0FOQ0VMX1RBU0snOiB7XHJcbiAgICAgICAgY29uc3QgeyBpZCB9ID0gbWVzc2FnZS5wYXlsb2FkXHJcbiAgICAgICAgZG93bmxvYWRNYW5hZ2VyPy5jYW5jZWxUYXNrKGlkKVxyXG4gICAgICAgIHRhc2tzID0gdGFza3MuZmlsdGVyKHQgPT4gdC5pZCAhPT0gaWQpXHJcbiAgICAgICAgYnJvYWRjYXN0VGFza3MoKVxyXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSlcclxuICAgICAgICBicmVha1xyXG4gICAgICB9XHJcbiAgICAgIGNhc2UgJ0NBTkNFTF9BTEwnOiB7XHJcbiAgICAgICAgZG93bmxvYWRNYW5hZ2VyPy5jYW5jZWxBbGwoKVxyXG4gICAgICAgIHRhc2tzID0gdGFza3MuZmlsdGVyKHQgPT4gdC5zdGF0dXMgPT09ICdjb21wbGV0ZWQnIHx8IHQuc3RhdHVzID09PSAnZXJyb3InKVxyXG4gICAgICAgIGJyb2FkY2FzdFRhc2tzKClcclxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pXHJcbiAgICAgICAgYnJlYWtcclxuICAgICAgfVxyXG4gICAgICBjYXNlICdDTEVBUl9DT01QTEVURUQnOiB7XHJcbiAgICAgICAgdGFza3MgPSB0YXNrcy5maWx0ZXIodCA9PiB0LnN0YXR1cyA9PT0gJ3F1ZXVlZCcgfHwgdC5zdGF0dXMgPT09ICdkb3dubG9hZGluZycpXHJcbiAgICAgICAgYnJvYWRjYXN0VGFza3MoKVxyXG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSlcclxuICAgICAgICBicmVha1xyXG4gICAgICB9XHJcbiAgICAgIGNhc2UgJ0dFVF9OSUNIRVMnOiB7XHJcbiAgICAgICAgaWYgKCFjdXJyZW50TmljaGVzIHx8IGN1cnJlbnROaWNoZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICBmZXRjaCgnaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS9uaWNob3MnKVxyXG4gICAgICAgICAgICAudGhlbihyZXMgPT4gcmVzLmpzb24oKSlcclxuICAgICAgICAgICAgLnRoZW4oZGF0YSA9PiB7XHJcbiAgICAgICAgICAgICAgaWYgKGRhdGEuc3VjY2VzcyAmJiBkYXRhLmRhdGEpIHtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnROaWNoZXMgPSBkYXRhLmRhdGFcclxuICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGN1cnJlbnROaWNoZXMgfSlcclxuICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogW10gfSlcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tCYWNrZ3JvdW5kXSBFcnJvIGFvIGNhcnJlZ2FyIG5pY2hvczonLCBlcnIpXHJcbiAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogW10gfSlcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgIHJldHVybiB0cnVlXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGN1cnJlbnROaWNoZXMgfSlcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWtcclxuICAgICAgfVxyXG4gICAgICBjYXNlICdHRVRfQ09ORklHJzoge1xyXG4gICAgICAgIGdldENvbmZpZygpLnRoZW4oY29uZmlnID0+IHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGNvbmZpZyB9KSlcclxuICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICB9XHJcbiAgICAgIGNhc2UgJ1NBVkVfQ09ORklHJzoge1xyXG4gICAgICAgIGdldENvbmZpZygpLnRoZW4oY3VycmVudENvbmZpZyA9PiB7XHJcbiAgICAgICAgICBjb25zdCB1cGRhdGVkQ29uZmlnID0geyAuLi5jdXJyZW50Q29uZmlnLCAuLi5tZXNzYWdlLnBheWxvYWQgfVxyXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tCYWNrZ3JvdW5kXSBTYWx2YW5kbyBjb25maWc6JywgdXBkYXRlZENvbmZpZylcclxuICAgICAgICAgIGNocm9tZS5zdG9yYWdlLnN5bmMuc2V0KHsgcG9zdHJlZWxzQ29uZmlnOiB1cGRhdGVkQ29uZmlnIH0sICgpID0+IHtcclxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogdXBkYXRlZENvbmZpZyB9KVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICB9KVxyXG4gICAgICAgIHJldHVybiB0cnVlXHJcbiAgICAgIH1cclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdVbmtub3duIHR5cGUnIH0pXHJcbiAgICB9XHJcbiAgfSlcclxufSlcclxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsIi8vI3JlZ2lvbiBzcmMvaW5kZXgudHNcbi8qKlxuKiBDbGFzcyBmb3IgcGFyc2luZyBhbmQgcGVyZm9ybWluZyBvcGVyYXRpb25zIG9uIG1hdGNoIHBhdHRlcm5zLlxuKlxuKiBAZXhhbXBsZVxuKiAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgTWF0Y2hQYXR0ZXJuKCcqOi8vZ29vZ2xlLmNvbS8qJyk7XG4qXG4qICAgcGF0dGVybi5pbmNsdWRlcygnaHR0cHM6Ly9nb29nbGUuY29tJyk7IC8vIHRydWVcbiogICBwYXR0ZXJuLmluY2x1ZGVzKCdodHRwOi8veW91dHViZS5jb20vd2F0Y2g/dj0xMjMnKTsgLy8gZmFsc2VcbiovXG52YXIgTWF0Y2hQYXR0ZXJuID0gY2xhc3MgTWF0Y2hQYXR0ZXJuIHtcblx0c3RhdGljIHtcblx0XHR0aGlzLlBST1RPQ09MUyA9IFtcblx0XHRcdFwiaHR0cFwiLFxuXHRcdFx0XCJodHRwc1wiLFxuXHRcdFx0XCJmaWxlXCIsXG5cdFx0XHRcImZ0cFwiLFxuXHRcdFx0XCJ1cm5cIixcblx0XHRcdFwid3NcIixcblx0XHRcdFwid3NzXCJcblx0XHRdO1xuXHR9XG5cdC8qKlxuXHQqIFBhcnNlIGEgbWF0Y2ggcGF0dGVybiBzdHJpbmcuIElmIGl0IGlzIGludmFsaWQsIHRoZSBjb25zdHJ1Y3RvciB3aWxsIHRocm93IGFuXG5cdCogYEludmFsaWRNYXRjaFBhdHRlcm5gIGVycm9yLlxuXHQqXG5cdCogQHBhcmFtIG1hdGNoUGF0dGVybiBUaGUgbWF0Y2ggcGF0dGVybiB0byBwYXJzZS5cblx0Ki9cblx0Y29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG5cdFx0aWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcblx0XHRcdHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLk1hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuXHRcdFx0dGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG5cdFx0XHR0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG5cdFx0XHRpZiAoZ3JvdXBzID09IG51bGwpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuXHRcdFx0Y29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuXHRcdFx0dmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcblx0XHRcdHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG5cdFx0XHR0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG5cdFx0XHR0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcblx0XHRcdHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuXHRcdH1cblx0fVxuXHQvKiogQ2hlY2sgaWYgYSBVUkwgaXMgaW5jbHVkZWQgaW4gYSBwYXR0ZXJuLiAqL1xuXHRpbmNsdWRlcyh1cmwpIHtcblx0XHRjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG5cdFx0aWYgKHRoaXMuaXNBbGxVcmxzKSByZXR1cm4gIXRoaXMuaXNVbmtub3duUHJvdG9jb2wodSk7XG5cdFx0cmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcImZ0cFwiKSByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcInVyblwiKSByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuXHRcdH0pO1xuXHR9XG5cdGlzSHR0cE1hdGNoKHVybCkge1xuXHRcdHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuXHR9XG5cdGlzSHR0cHNNYXRjaCh1cmwpIHtcblx0XHRyZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG5cdH1cblx0aXNIb3N0UGF0aE1hdGNoKHVybCkge1xuXHRcdGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpIHJldHVybiBmYWxzZTtcblx0XHRjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW3RoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXTtcblx0XHRjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuXHRcdHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcblx0fVxuXHRpc1Vua25vd25Qcm90b2NvbCh1cmwpIHtcblx0XHRyZXR1cm4gIXRoaXMucHJvdG9jb2xNYXRjaGVzLmluY2x1ZGVzKHVybC5wcm90b2NvbC5zbGljZSgwLCAtMSkpO1xuXHR9XG5cdGlzUGF0aE1hdGNoKHVybCkge1xuXHRcdGlmICghdGhpcy5wYXRobmFtZU1hdGNoKSByZXR1cm4gZmFsc2U7XG5cdFx0cmV0dXJuIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCkudGVzdCh1cmwucGF0aG5hbWUpO1xuXHR9XG5cdGlzRmlsZU1hdGNoKHVybCkge1xuXHRcdHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiZmlsZTpcIiAmJiB0aGlzLmlzUGF0aE1hdGNoKHVybCk7XG5cdH1cblx0aXNGdHBNYXRjaChfdXJsKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG5cdH1cblx0aXNVcm5NYXRjaChfdXJsKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG5cdH1cblx0Y29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcblx0XHRjb25zdCBzdGFyc1JlcGxhY2VkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKS5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG5cdFx0cmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG5cdH1cblx0ZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG5cdH1cbn07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuXHRcdHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG5cdH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcblx0aWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuXHRpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKSB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcblx0aWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgKTtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgSW52YWxpZE1hdGNoUGF0dGVybiwgTWF0Y2hQYXR0ZXJuIH07XG4iXSwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsNCw1LDZdLCJtYXBwaW5ncyI6Ijs7Q0FDQSxTQUFTLGlCQUFpQixLQUFLO0VBQzlCLElBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxZQUFZLE9BQU8sRUFBRSxNQUFNLElBQUk7RUFDakUsT0FBTztDQUNSOzs7Q0NBQSxJQUFhLGtCQUFiLE1BQTZCO0VBQzNCLFFBQWdDLENBQUM7RUFDakMseUJBQWlCLElBQUksSUFBNkI7RUFDbEQ7RUFDQTtFQUNBLFVBQWtCO0VBQ2xCLFVBQXNDO0VBRXRDLFlBQVksUUFBeUIsVUFBd0I7R0FDM0QsS0FBSyxTQUFTO0dBQ2QsS0FBSyxXQUFXO0VBQ2xCO0VBRUEsU0FBUyxPQUF1QixTQUF1QjtHQUNyRCxJQUFJLFNBQVMsS0FBSyxVQUFVO0dBQzVCLEtBQUssTUFBTSxLQUFLLEdBQUcsS0FBSztHQUN4QixLQUFLLGFBQWE7RUFDcEI7RUFFQSxNQUFjLGVBQWU7R0FDM0IsT0FBTyxLQUFLLFVBQVUsS0FBSyxPQUFPLGVBQWUsS0FBSyxNQUFNLFNBQVMsR0FBRztJQUN0RSxNQUFNLE9BQU8sS0FBSyxNQUFNLE1BQU07SUFDOUIsSUFBSSxDQUFDLE1BQU07SUFDWCxLQUFLO0lBQ0wsS0FBSyxhQUFhLElBQUksQ0FBQyxDQUFDLGNBQWM7S0FDcEMsS0FBSztLQUNMLEtBQUssYUFBYTtJQUNwQixDQUFDO0dBQ0g7RUFDRjtFQUVBLE1BQWMsYUFBYSxNQUFvQjtHQUM3QyxNQUFNLGFBQWEsSUFBSSxnQkFBZ0I7R0FDdkMsS0FBSyxPQUFPLElBQUksS0FBSyxJQUFJLFVBQVU7R0FFbkMsSUFBSTtJQUNGLFFBQVEsSUFBSSxvQ0FBb0MsS0FBSyxTQUFTO0lBQzlELEtBQUssU0FBUztJQUNkLEtBQUssU0FBUyxJQUFJO0lBRWxCLE1B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