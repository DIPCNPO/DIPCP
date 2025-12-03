// 存储服务 - 根据 PRD 2.9 重新实现
window.StorageService = {
	dbName: 'DIPCP_Database',
	dbVersion: 1,
	db: null,
	initPromise: null,
	/**
	 * 初始化IndexedDB
	 */
	async initDB() {
		// 如果已经初始化，直接返回
		if (this.db) {
			return this.db;
		}

		// 如果正在初始化，复用同一个Promise
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				console.error('IndexedDB open failed:', request.error);
				this.initPromise = null;
				reject(request.error);
			};

			request.onsuccess = () => {
				// 确保在成功时设置 db 对象（即使数据库已存在，onupgradeneeded 不会被调用）
				this.db = request.result;
				this.db.onclose = () => {
					console.warn('IndexedDB connection closed, resetting db reference');
					this.db = null;
				};
				const db = this.db;
				this.initPromise = null;
				resolve(db);
			};

			request.onupgradeneeded = (event) => {
				const db = event.target.result;
				this.db = db;

				// 创建KVStorage表
				if (!db.objectStoreNames.contains('KVStorage')) {
					const kvStore = db.createObjectStore('KVStorage', { keyPath: 'key' });
				}
				// 创建files表
				if (!db.objectStoreNames.contains('files')) {
					const filesStore = db.createObjectStore('files', { keyPath: 'path' });
					// 对repo字段建索引
					filesStore.createIndex('repo', 'repo', { unique: false });
				}
				// 创建pending表
				if (!db.objectStoreNames.contains('pending')) {
					db.createObjectStore('pending', { keyPath: 'path' });
				}
				// 创建links表
				if (!db.objectStoreNames.contains('links')) {
					// 以自增id为主键，autoIncrement设为true
					const linksStore = db.createObjectStore('links', { keyPath: 'id', autoIncrement: true });
					// 对repo字段建索引
					linksStore.createIndex('repo', 'repo', { unique: false });
				}
				// 创建MediaCache表（存储图片和音频文件）
				if (!db.objectStoreNames.contains('medias')) {
					db.createObjectStore('medias', { keyPath: 'path' });
				}
				// 创建Voting表（存储需要提交的投票数据）
				if (!db.objectStoreNames.contains('voting')) {
					db.createObjectStore('voting', { keyPath: 'path' });
				}
				// 创建Creation表（存储每日更新的作品统计数据）
				if (!db.objectStoreNames.contains('creations')) {
					const creationStore = db.createObjectStore('creations', { keyPath: 'repository' });
					// 对name字段建索引
					creationStore.createIndex('name', 'name', { unique: false });
				}
			};
		});

		return this.initPromise;
	},

	/**
	 * 清空数据库所有表的内容（不删除数据库结构）
	 */
	async clear() {
		try {
			// 确保数据库已初始化
			const db = await this.initDB();
			if (!db) {
				throw new Error('数据库未初始化');
			}

			// 获取所有表名
			const storeNames = Array.from(db.objectStoreNames);

			// 使用一个事务清空所有表（更高效）
			return new Promise((resolve, reject) => {
				const transaction = db.transaction(storeNames, 'readwrite');

				// 为每个表创建清空请求
				const clearRequests = storeNames.map(storeName => {
					const store = transaction.objectStore(storeName);
					const request = store.clear();
					return request;
				});

				// 监听事务完成
				transaction.oncomplete = () => {
					resolve();
				};

				transaction.onerror = () => {
					console.error('[StorageService] 清空数据库失败:', transaction.error);
					reject(transaction.error);
				};

				transaction.onabort = () => {
					console.error('[StorageService] 清空数据库事务被中止');
					reject(new Error('清空数据库事务被中止'));
				};
			});

		} catch (error) {
			throw error;
		}
	},

	/**
	 * 执行IndexedDB操作
	 * @param {string} storeName - 存储名称
	 * @param {string} operation - 操作类型
	 * @param {...any} args - 操作参数
	 */
	async execute(storeName, operation, ...args) {
		const db = await this.initDB();

		if (!db) {
			throw new Error('Database initialization failed: db is null');
		}

		const transaction = db.transaction([storeName], 'readwrite');
		const store = transaction.objectStore(storeName);

		return new Promise((resolve, reject) => {
			const request = store[operation](...args);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	},

	// ==================== KV存储相关 ====================

	/**
	 * 保存KV对（值加密）
	 * @param {string} key - 键
	 * @param {Object} value - 值（会被加密）
	 */
	async saveKV(key, value) {
		try {
			const encryptedValue = this._encrypt(JSON.stringify(value));
			await this.execute('KVStorage', 'put', {
				key: key,
				value: encryptedValue,
			});
		} catch (error) {
			console.error('保存KV失败:', error);
			throw error;
		}
	},

	/**
	 * 获取KV值（值解密）
	 * @param {string} key - 键
	 * @returns {Object} 解密后的值，如果不存在返回null
	 */
	async getKV(key) {
		try {
			const result = await this.execute('KVStorage', 'get', key);
			if (!result) {
				return null;
			}
			const decryptedValue = this._decrypt(result.value);
			return JSON.parse(decryptedValue);
		} catch (error) {
			console.error('获取KV失败:', error);
			return null;
		}
	},

	// ==================== 文件相关 ====================

	/**
	 * 读取文件
	 * @param {string} path - 文件路径
	 * @param {function} callback - 回调函数
	 */
	async readFile(path, callback) {
		try {
			const file = await this.execute('files', 'get', path);
			const { owner } = window.app.parsePath(path);
			const userName = window.app.user.username || window.app.user.name;

			// 判断是否为自己编写的文件
			const isOwnFile = owner === userName;

			const forceUpdate = window.app.setting.always_refresh;
			// 保存当前文件路径到KV表
			window.app.setting.current_article = path;
			await window.StorageService.saveKV('setting', window.app.setting);

			// 如果不是自己的文件，且（不存在或需要强制更新），则自动下载
			if (!isOwnFile && (!file || forceUpdate)) {
				// 触发下载
				await this.downloadFile(path, callback);
			} else {
				// 直接返回从数据库读取的文件数据（包含最新的投票状态）
				callback(file);
			}
		} catch (error) {
			console.error('读取文件失败:', error);
			throw error;
		}
	},

	/**
	 * 保存文件，更新版本号和时间
	 * @param {string} path - 文件路径
	 * @param {string} content - 文件内容
	 */
	async saveFile(path, content) {
		try {
			const { filename, repo, owner } = window.app.parsePath(path);

			// 创建文件对象
			const fileData = {
				path: path,
				repo: repo,
				owner: owner,
				filename: filename,
				content: content,
				vote: -2,
				scrollTop: 0
			};

			// 保存到数据库
			await this.execute('files', 'put', fileData);

			return fileData;
		} catch (error) {
			console.error('保存文件失败:', error);
			throw error;
		}
	},

	/**
	 * 删除文件（自己编写的文件）
	 * @param {string} path - 文件路径
	 */
	async deleteFile(path) {
		try {
			const { owner } = window.app.parsePath(path);
			if (owner === window.app.user.username) {
				await this.execute('files', 'delete', path);
			}
		} catch (error) {
			console.error('删除文件失败:', error);
			throw error;
		}
	},

	// ==================== 待提交文件相关 ====================

	/**
	 * 保存待提交文件
	 * @param {string} path - 文件路径
	 */
	async savePendingFile(path) {
		const { repo } = window.app.parsePath(path);

		// 创建待提交文件对象
		const pendingData = {
			path: path,
			repo: repo,
		};

		await this.execute('pending', 'put', pendingData);

		// 更新全局状态
		if (window.app && window.app.updatePendingFile) {
			await window.app.updatePendingFile(path, true);
		}
	},

	/**
	 * 删除待提交文件
	 * @param {string} path - 文件路径
	 */
	async deletePendingFile(path) {
		await this.execute('pending', 'delete', path);

		// 更新全局状态
		if (window.app && window.app.updatePendingFile) {
			await window.app.updatePendingFile(path, false);
		}
	},

	/**
	 * 获取指定仓库中的所有待提交文件
	 * @param {string} repo - 仓库名
	 * @returns {Promise<Object[]>} 待提交文件列表
	 */
	async getPendingFiles(repo) {
		const pendingFiles = await this.execute('pending', 'getAll');
		return pendingFiles.filter(file => file.repo === repo);
	},

	/**
	 * 投票
	 * @param {string} path - 标准路径
	 * @param {number} vote - 投票值（-1, 0, 1）
	 */
	async voting(path, vote) {
		try {
			// 验证投票值
			if (vote !== -1 && vote !== 0 && vote !== 1) {
				throw new Error(`Invalid vote value: ${vote}. Must be -1, 0, or 1`);
			}
			const fileData = await this.execute('files', 'get', path);
			const { owner } = window.app.parsePath(path);
			const userName = window.app.user.username || window.app.user.name;
			// 如果不是自己编写的文件，则更新投票
			if (owner !== userName && fileData) {
				// 无论投票值是否改变，都更新（允许用户改变投票）
				fileData.vote = vote;
				await this.execute('files', 'put', fileData);
				// voting表使用path作为keyPath，需要传递包含path的对象
				await this.execute('voting', 'put', { path: path, vote: vote });
			}
		} catch (error) {
			console.error('投票失败:', error);
			throw error;
		}
	},

	/**
	 * 更新作品历史记录
	 * @param {Object} creation - 作品对象
	 */
	async updateCreation(creation) {
		await this.execute('creations', 'put', creation);
	},

	/**
	 * 获取所有的作品列表，按照最后阅读时间排序
	 * @returns {Promise<Object[]>} 作品列表
	 */
	async getCreations() {
		const creations = await this.execute('creations', 'getAll');
		return creations.sort((a, b) => b.last_read - a.last_read);
	},

	/**
	 * 获取一个作品的详细信息
	 * @param {string} name - 作品名
	 * @returns {Promise<Object>} 作品信息
	 */
	async getCreation(name) {
		const db = await this.initDB();
		if (!db) {
			throw new Error('Database initialization failed: db is null');
		}

		// name 是索引键，不是主键，需要通过索引查询
		const transaction = db.transaction(['creations'], 'readonly');
		const store = transaction.objectStore('creations');
		const index = store.index('name');

		return new Promise((resolve, reject) => {
			const request = index.get(name);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	},

	/**
	 * 获取仓库的文件树结构（包括子目录）
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<Object>} 文件树对象，格式为 { type: 'directory', name: 'dir', children: [...] }
	 */
	async getRepositoryFiles(repo) {
		try {
			const allFiles = await this.execute('files', 'getAll');
			const mdFiles = allFiles
				.filter(file => file.repo === repo)
				.map(file => {
					// 解析路径，获取正确的相对路径（去掉 owner/repo 两层）
					const parsed = window.app.parsePath(file.path);
					if (!parsed) {
						console.warn('无法解析文件路径:', file.path);
						return null;
					}

					// 构建相对路径（去掉 owner/repo，保留 dirPath 和 filename）
					const pathParts = [];
					if (parsed.dirPath) {
						pathParts.push(parsed.dirPath);
					}
					pathParts.push(parsed.fullFilename || parsed.filename);
					const relativePath = pathParts.join('/');

					return {
						path: file.path,
						name: parsed.fullFilename || parsed.filename,
						relativePath: relativePath
					};
				})
				.filter(file => file !== null);

			// 构建文件树
			const tree = { type: 'directory', name: '', children: [] };

			mdFiles.forEach(file => {
				// relativePath 已经去掉了 owner/repo，现在直接使用
				const parts = file.relativePath ? file.relativePath.split('/') : [];

				// 如果 parts 为空或只有一个元素（文件名），说明文件在根目录
				if (parts.length === 0) {
					return; // 跳过空路径
				}

				let current = tree;

				parts.forEach((part, index) => {
					const isFile = index === parts.length - 1;

					if (isFile) {
						// 文件节点
						current.children.push({
							type: 'file',
							name: part,
							path: file.path,
							relativePath: file.relativePath
						});
					} else {
						// 目录节点
						let dir = current.children.find(child => child.type === 'directory' && child.name === part);
						if (!dir) {
							const dirPath = parts.slice(0, index + 1).join('/');
							dir = {
								type: 'directory',
								name: part,
								path: dirPath,
								children: [],
								expanded: false
							};
							current.children.push(dir);
						}
						current = dir;
					}
				});
			});

			// 排序：目录在前，文件在后，各自按名称排序
			const sortChildren = (children) => {
				children.sort((a, b) => {
					if (a.type !== b.type) {
						return a.type === 'directory' ? -1 : 1;
					}
					return a.name.localeCompare(b.name);
				});
				children.forEach(child => {
					if (child.type === 'directory') {
						sortChildren(child.children);
					}
				});
			};

			sortChildren(tree.children);
			return tree;
		} catch (error) {
			console.error('获取仓库文件树失败:', error);
			throw error;
		}
	},

	/**
	 * 获取所有投票结果后清理投票
	 * @returns {Promise<Object[]>} 投票数据
	 */
	async clearVoting() {
		try {
			const votingData = await this.execute('voting', 'getAll');
			await this.execute('voting', 'clear');
			return votingData;
		} catch (error) {
			console.error('清理投票失败:', error);
			throw error;
		}
	},

	/** 
	 * 批量下载文件，下载之前先检查本地是否存在，支持多线程
	 * @param {string[]} paths - 文件路径数组
	 */
	async downloadFiles(paths) {
		// 将以.开头的文件过滤掉
		paths = paths.filter(p => !p.startsWith('.'));
		const toDownload = [];
		// 并发检查本地是否存在
		const checks = await Promise.all(paths.map(async (p) => {
			try {
				const file = await this.execute('files', 'get', p);
				return { path: p, file };
			} catch (e) {
				return { path: p, file: null };
			}
		}));

		for (const { path, file } of checks) {
			if (!file) {
				toDownload.push(path);
			}
		}

		if (toDownload.length > 0) {
			await this._downloadFiles(toDownload, () => { });
		}
	},

	/**
	 * 多线程下载文件（带并发上限）
	 * @private
	 * @param {string[]} paths - 需要下载的标准路径数组
	 * @param {Function} callback - 回调函数
	 */
	async _downloadFiles(paths, callback) {
		if (!paths || paths.length === 0) return;
		const CONCURRENCY = 5;
		let cursor = 0;

		const worker = async () => {
			while (true) {
				let current;
				if (cursor >= paths.length) return;
				current = paths[cursor++];
				try {
					await this.downloadFile(current, callback);
				} catch (error) {
					console.warn('下载文件失败:', current, error);
				}
			}
		};

		const workers = Array.from({ length: Math.min(CONCURRENCY, paths.length) }, () => worker());
		await Promise.all(workers);
	},

	/**
	 * 刷新文章
	 * @param {string} path - 文章路径
	 * @returns {Promise<Object>} 刷新后的文件对象
	 */
	async refreshFile(path) {
		// 先检查本地是否已有文件，保留投票
		const existingFile = await this.execute('files', 'get', path);

		// 强制从 GitHub 下载最新版本
		const content = await this._downloadFromGitHub(path);
		const parsed = window.app.parsePath(path);
		if (!parsed) {
			throw new Error('无法解析文件路径');
		}

		// 构建文件对象，保留原有的投票，滚动位置为0
		const fileData = {
			path: path,
			repo: parsed.repo,
			owner: parsed.owner,
			filename: parsed.filename,
			content: content,
			vote: existingFile?.vote !== undefined ? existingFile.vote : -2,
			scrollTop: 0
		};

		// 保存到数据库
		await this.execute('files', 'put', fileData);
		return fileData;
	},

	/**
	 * 从GitHub下载文件
	 * @param {string} path - 标准路径
	 * @returns {Promise<string>} 文件内容
	 * @private
	 */
	async _downloadFromGitHub(path) {
		const parsed = window.app.parsePath(path);
		if (!parsed || !parsed.owner || !parsed.repo || !parsed.fullFilename) {
			throw new Error(`无效的路径格式: ${path}`);
		}
		const { owner, repo, dirPath, fullFilename } = parsed;

		// 构建完整的文件路径（包含目录路径），并对路径进行编码
		const filePath = dirPath ? `${dirPath}/${fullFilename}` : fullFilename;
		const encodedFilePath = filePath
			.split('/')
			.map(segment => encodeURIComponent(segment))
			.join('/');
		const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodedFilePath}`;

		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`下载失败: ${response.status} ${response.statusText}`);
			}

			return await response.text();
		} catch (error) {
			console.error('从GitHub下载文件失败:', error);
			throw error;
		}
	},

	/**
	 * 文件下载
	 * @param {string} path - 文件路径
	 * @param {Function} callback - 回调函数，参数为下载的文件对象
	 */
	async downloadFile(path, callback) {
		try {
			if (!path || typeof path !== 'string') return;
			// 先检查本地是否已有文件，保留投票和滚动位置
			const existingFile = await this.execute('files', 'get', path);

			// 下载最新文件
			const content = await this._downloadFromGitHub(path);
			const { filename, repo, owner } = window.app.parsePath(path);

			// 构建文件对象，保留原有的投票和滚动位置
			const fileData = {
				path: path,
				repo: repo,
				owner: owner,
				filename: filename,
				content: content,
				vote: existingFile?.vote !== undefined ? existingFile.vote : -2,
				scrollTop: existingFile?.scrollTop !== undefined ? existingFile.scrollTop : 0
			};
			callback(fileData);
			// 保存到数据库
			await this.execute('files', 'put', fileData);
		} catch (error) {
			console.error('文件下载失败:', error);
			throw error;
		}
	},

	/**
	 * 翻译文件
	 * @param {Object} fileData - 文件对象
	 * @param {Function} callback - 回调函数，参数为翻译结果
	 */
	async translateFile(fileData, callback) {
		// 如果开启了自动翻译，进行翻译
		if (window.app.settings.third_party && window.app.settings.third_parties.length > 0) {
			// 检查是否有流式回调函数
			const streamCallback = callback && typeof callback === 'function' ?
				async (chunk, fullText, isDone) => {
					if (chunk) {
						// 实时更新文件对象的翻译字段（不保存，只是更新内存中的对象）
						fileData.translation = fullText;
						// 实时回调给调用端
						callback({
							type: 'translate-chunk',
							chunk,
							fullText,
							isDone: false,
							fileData
						});
					}
					// 如果完成，保存到数据库
					if (isDone) {
						fileData.translation = fullText;
						await this.execute('files', 'put', fileData);
						callback({
							type: 'translate-complete',
							chunk: '',
							fullText,
							isDone: true,
							fileData
						});
					}
				} : null;
			await this._autoTranslate(fileData, streamCallback);
		}
	},

	/**
	 * 解析文章中的图像和音频链接
	 * @param {string} content - 文章内容
	 * @returns {string[]} 媒体文件URL数组
	 */
	parseMediaLinks(content) {
		const mediaUrls = [];

		// 匹配Markdown图片链接: ![alt](url.jpg/jpeg/png)
		const imageRegex = /!\[([^\]]*)\]\(([^)]+)\.(jpg|jpeg|png)\)/g;
		let match;
		while ((match = imageRegex.exec(content)) !== null) {
			mediaUrls.push(match[2] + '.' + match[3]);
		}

		// 匹配HTML图片标签: <img src="url">
		const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/gi;
		while ((match = htmlImageRegex.exec(content)) !== null) {
			mediaUrls.push(match[1]);
		}

		// 匹配音频链接
		const audioRegex = /<audio[^>]+src=["']([^"']+)["']/gi;
		while ((match = audioRegex.exec(content)) !== null) {
			mediaUrls.push(match[1]);
		}

		// 去重并返回
		return [...new Set(mediaUrls)];
	},

	/**
	 * 解析文章中的文本链接
	 * @param {string} content - 文章内容
	 * @returns {string[]} 文本链接数组
	 */
	parseTextLinks(content) {
		const mdUrls = [];

		// 匹配Markdown文件链接: ![alt](url.md)
		const mdRegex = /!\[([^\]]*)\]\(([^)]+)\.md\)/g;
		let match;
		while ((match = mdRegex.exec(content)) !== null) {
			mdUrls.push(match[2]);
		}

		// 去重并返回
		return [...new Set(mdUrls)];
	},

	/**
	 * 多线程下载媒体文件
	 * @param {string[]} medias - 媒体文件路径数组
	 * @param {Function} callback - 回调函数，参数为下载的媒体文件对象
	 */
	async downloadMediaFiles(medias, callback) {
		const downloadMedias = [];
		for (const path of medias) {
			const blob = await this.getMedia(path);
			if (blob) {
				if (callback) callback({ type: 'media-download-complete', path, blob });
			} else {
				downloadMedias.push(path);
			}
		}
		if (downloadMedias.length == 0) return;
		// 固定并发工作池（最多5个同时下载）
		const CONCURRENCY = 5;
		let cursor = 0;

		const worker = async () => {
			while (true) {
				let current;
				if (cursor >= downloadMedias.length) return;
				current = downloadMedias[cursor++];
				try {
					await this._downloadSingleMediaFile(current, callback);
				} catch (error) {
					console.warn('下载媒体文件失败:', current, error);
				}
			}
		};

		const workers = Array.from({ length: Math.min(CONCURRENCY, downloadMedias.length) }, () => worker());
		await Promise.all(workers);
	},

	/**
	 * 下载媒体文件
	 * @private
	 * @param {string} path - 标准路径
	 * @param {Function} callback - 回调函数，参数为下载的媒体文件对象
	 */
	async _downloadSingleMediaFile(path, callback) {
		try {
			const parsed = window.app.parsePath(path);
			if (!parsed || !parsed.owner || !parsed.repo || !parsed.fullFilename) {
				throw new Error(`无效的路径格式: ${path}`);
			}
			const { owner, repo, dirPath, fullFilename } = parsed;

			// 构建完整的文件路径（包含目录路径），并对路径进行编码
			const filePath = dirPath ? `${dirPath}/${fullFilename}` : fullFilename;
			const encodedFilePath = filePath
				.split('/')
				.map(segment => encodeURIComponent(segment))
				.join('/');
			const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodedFilePath}`;
			let response = await fetch(url);

			if (!response.ok) {
				throw new Error(`下载失败: ${response.status} ${response.statusText}`);
			}

			// 获取二进制数据
			const blob = await response.blob();

			await this.saveMedia(path, blob);
			if (callback) callback({ type: 'media-download-complete', path, blob });

		} catch (error) {
			console.error('❌ [_downloadSingleMediaFile] 下载媒体文件失败:', path, error);
			callback(null);
		}
	},

	/**
	 * 获取媒体文件
	 * @private
	 * @param {string} path - 标准路径
	 * @returns {Promise<Object|null>} 缓存的媒体对象或null
	 */
	async getMedia(path) {
		try {
			const result = await this.execute('medias', 'get', path);
			if (result && result.data) {
				// 从 ArrayBuffer 重建 Blob
				const blob = new Blob([result.data], { type: result.contentType });
				// 检查 Blob 大小是否异常（小于 100 bytes 可能是错误数据）
				if (blob.size < 100) {
					// 删除损坏的数据，重新下载
					await this.execute('medias', 'delete', path).catch(() => { });
					// 继续执行下载逻辑
				} else {
					return blob;
				}
			}
			// 如果未找到或数据损坏，则下载并保存
			return new Promise((resolve) => {
				this._downloadSingleMediaFile(path, (result) => {
					if (result && result.blob) {
						resolve(result.blob);
					} else {
						resolve(null);
					}
				});
			});
		} catch (error) {
			console.error('❌ [getMedia] 获取媒体文件异常:', path, error);
			return null;
		}
	},

	/**
	 * 保存媒体文件
	 * @private
	 * @param {string} path - 路径
	 * @param {Blob} blob - 媒体文件Blob
	 */
	async saveMedia(path, blob) {
		try {
			const arrayBuffer = await blob.arrayBuffer();
			const contentType = window.app.parsePath(path).extension;
			const mediaData = {
				path: path,
				data: arrayBuffer,
				contentType: contentType
			};
			await this.execute('medias', 'put', mediaData);
		} catch (error) {
			console.error('保存媒体文件到缓存失败:', error);
			throw error;
		}
	},

	/**
	 * 自动翻译
	 * @private
	 * @param {Object} fileData - 文件对象
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 */
	async _autoTranslate(fileData, streamCallback) {
		// 尝试每个第三方API，直到成功或全部失败
		for (const third_party of window.app.setting.third_parties) {
			try {
				await this._callTranslateAPI(
					third_party.provider,
					third_party.apiKey,
					fileData.content,
					window.app.setting.language,
					streamCallback
				);
				return;
			} catch (error) {
				console.warn(`使用第三方API翻译失败 (${third_party.provider}):`, error);
				// 继续尝试下一个第三方API
			}
		}

		// 所有密钥都失败，通知调用方
		console.error('所有翻译API密钥都失败');
		callback({
			type: 'translate-failed',
			file: fileData,
		});
	},

	/**
	 * 调用翻译API
	 * @private
	 * @param {string} provider - 提供商 (openai, deepseek, gemini等)
	 * @param {string} apiKey - API密钥
	 * @param {string} text - 要翻译的文本
	 * @param {string} targetLanguage - 目标语言
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 */
	async _callTranslateAPI(provider, apiKey, text, targetLanguage, streamCallback) {
		const prompt = `You are a professional Markdown translator. Translate the following text to ${targetLanguage}. Preserve Markdown syntax and structure. For Markdown links like [text](path), translate only the [text] but do NOT modify the (path) if it does not start with http:// or https://; keep such relative paths exactly unchanged. Only return the translated text, no explanations.`;
		// 根据不同的提供商调用不同的API
		switch (provider.toLowerCase()) {
			case 'openai':
				await this._translateWithOpenAI(apiKey, text, prompt, streamCallback);
			case 'deepseek':
				await this._translateWithDeepSeek(apiKey, text, prompt, streamCallback);
			case 'gemini':
				await this._translateWithGemini(apiKey, text, prompt, streamCallback);
			default:
				throw new Error(`不支持的翻译提供商: ${provider}`);
		}
	},

	/**
	 * 使用OpenAI翻译（支持流模式）
	 * @private
	 * @param {string} apiKey - API密钥
	 * @param {string} text - 要翻译的文本
	 * @param {string} prompt - 提示词
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 */
	async _translateWithOpenAI(apiKey, text, prompt, streamCallback) {
		const useStream = streamCallback !== null;

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [
					{
						role: 'system',
						content: prompt
					},
					{
						role: 'user',
						content: text
					}
				],
				temperature: 0.3,
				stream: useStream
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		if (useStream) {
			return await this._processOpenAIStream(response, streamCallback);
		} else {
			const data = await response.json();
			return data.choices[0].message.content.trim();
		}
	},

	/**
	 * 使用DeepSeek翻译（支持流模式）
	 * @private
	 * @param {string} apiKey - API密钥
	 * @param {string} text - 要翻译的文本
	 * @param {string} prompt - 提示词
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 */
	async _translateWithDeepSeek(apiKey, text, prompt, streamCallback) {
		const useStream = streamCallback !== null;

		const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'deepseek-chat',
				messages: [
					{
						role: 'system',
						content: prompt
					},
					{
						role: 'user',
						content: text
					}
				],
				temperature: 0.3,
				stream: useStream
			})
		});

		if (!response.ok) {
			throw new Error(`DeepSeek API error: ${response.statusText}`);
		}

		if (useStream) {
			return await this._processOpenAIStream(response, streamCallback);
		} else {
			const data = await response.json();
			return data.choices[0].message.content.trim();
		}
	},

	/**
	 * 使用Gemini翻译（支持流模式）
	 * @param {string} apiKey - API密钥
	 * @param {string} text - 要翻译的文本
	 * @param {string} prompt - 提示词
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 * @private
	 */
	async _translateWithGemini(apiKey, text, prompt, streamCallback) {
		const useStream = streamCallback !== null;
		const endpoint = useStream ? 'streamGenerateContent' : 'generateContent';

		// Gemini API 使用不同的端点
		const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:${endpoint}?key=${apiKey}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contents: [{
					parts: [{
						text: `${prompt}\n\n${text}`
					}]
				}]
			})
		});

		if (!response.ok) {
			throw new Error(`Gemini API error: ${response.statusText}`);
		}

		if (useStream) {
			return await this._processGeminiStream(response, streamCallback);
		} else {
			const data = await response.json();
			return data.candidates[0].content.parts[0].text.trim();
		}
	},

	/**
	 * 处理OpenAI/DeepSeek的流式响应
	 * @param {Response} response - 响应对象
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 * @private
	 */
	async _processOpenAIStream(response, streamCallback) {
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullText = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					// 流结束，调用完成回调
					if (streamCallback) {
						await streamCallback('', fullText, true);
					}
					break;
				}

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') {
							// 流结束标记
							if (streamCallback) {
								await streamCallback('', fullText, true);
							}
							return fullText;
						}

						try {
							const json = JSON.parse(data);
							const delta = json.choices?.[0]?.delta?.content;
							if (delta) {
								fullText += delta;
								// 实时回调给调用端
								if (streamCallback) {
									await streamCallback(delta, fullText, false);
								}
							}
						} catch (e) {
							// 忽略解析错误
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		return fullText;
	},

	/**
	 * 处理Gemini的流式响应
	 * @param {Response} response - 响应对象
	 * @param {Function} streamCallback - 流式回调函数，参数为 (chunk: string, fullText: string, isDone: boolean)
	 * @private
	 */
	async _processGeminiStream(response, streamCallback) {
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullText = '';
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					// 处理剩余的 buffer
					if (buffer.trim()) {
						try {
							const json = JSON.parse(buffer);
							const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
							if (text) {
								if (text.length > fullText.length) {
									const delta = text.slice(fullText.length);
									fullText = text;
									if (streamCallback) {
										await streamCallback(delta, fullText, false);
									}
								} else if (text !== fullText) {
									fullText += text;
									if (streamCallback) {
										await streamCallback(text, fullText, false);
									}
								}
							}
						} catch (e) {
							// 忽略解析错误
						}
					}
					// 流结束，调用完成回调
					if (streamCallback) {
						await streamCallback('', fullText, true);
					}
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // 保留最后一个不完整的行

				for (const line of lines) {
					if (line.trim() === '') continue;

					try {
						// Gemini 流式响应格式: 每行是一个JSON对象
						const json = JSON.parse(line);
						const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
						if (text) {
							// Gemini 可能返回完整文本，需要提取增量
							if (text.length > fullText.length) {
								const delta = text.slice(fullText.length);
								fullText = text;
								if (streamCallback) {
									await streamCallback(delta, fullText, false);
								}
							} else if (text === fullText) {
								// 如果是完整重复，忽略
								continue;
							} else {
								// 可能是新的响应块
								fullText += text;
								if (streamCallback) {
									await streamCallback(text, fullText, false);
								}
							}
						}
					} catch (e) {
						// 忽略解析错误
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		return fullText;
	},

	/**
	 * 简单的加密函数（使用 Base64 + 简单混淆）
	 * @param {string} value - 要加密的值
	 * @returns {string} 加密后的值
	 */
	_encrypt(value) {
		try {
			// 简单的加密：Base64编码 + 反转字符串
			const encoded = btoa(unescape(encodeURIComponent(value)));
			return encoded.split('').reverse().join('');
		} catch (error) {
			console.error('加密失败:', error);
			return value;
		}
	},

	/**
	 * 简单的解密函数
	 * @param {string} encryptedValue - 加密后的值
	 * @returns {string} 解密后的值
	 */
	_decrypt(encryptedValue) {
		try {
			// 解密：反转字符串 + Base64解码
			const reversed = encryptedValue.split('').reverse().join('');
			return decodeURIComponent(escape(atob(reversed)));
		} catch (error) {
			console.error('解密失败:', error);
			return encryptedValue;
		}
	},
};