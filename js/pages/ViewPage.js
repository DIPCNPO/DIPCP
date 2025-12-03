/**
 * 阅读页面组件
 * @class ViewPage
 * @extends {BasePage}
 */
class ViewPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.state = {
			loading: true,
			article: null,
			penName: null,
			version: null,
			updateTime: null,
			createTime: null,
			isAuthor: false,
			showDirectory: false,
			directoryTree: null
		};
		this.beforeUnloadHandler = null;
	}

	/**
	 * 挂载组件到容器
	 * @param {HTMLElement} container - 容器元素
	 * @param {any} path - 路径参数（可选）
	 */
	async mount(container, path = null) {
		await super.mount(container, path);

		// 更新固定定位的top值
		this.updateStickyPositions();

		// 监听窗口大小变化和元素大小变化，更新固定定位
		this.resizeObserver = new ResizeObserver(() => {
			this.updateStickyPositions();
		});

		const mainElement = this.element?.querySelector('.project-detail-main');
		if (mainElement) {
			this.resizeObserver.observe(mainElement);
		}

		const header = this.element?.querySelector('.header');
		if (header) {
			this.resizeObserver.observe(header);
		}

		// 绑定页面离开事件
		this.beforeUnloadHandler = (e) => this.handleBeforeUnload(e);
		window.addEventListener('beforeunload', this.beforeUnloadHandler);
	}

	/**
	 * 组件挂载完成后的回调
	 */
	componentDidMount() {
		// 绑定事件（确保 DOM 完全渲染后再绑定）
		this.bindEvents();
	}

	/**
	 * 渲染组件
	 * @returns {HTMLElement} 渲染后的DOM元素
	 */
	async render() {
		// 加载文章数据
		await this.loadArticleData();

		const container = document.createElement('div');
		container.className = 'dashboard';

		container.innerHTML = `
			${this.renderHeader()}
			<main class="project-detail-main">
				${this.renderToolbar()}
				<div class="view-content">
					${this.renderCopyrightInfo()}
					${this.renderMainContent()}
				</div>
			</main>
		`;
		return container;
	}

	/**
	 * 渲染版权许可区
	 * @returns {string} 版权许可区HTML字符串
	 */
	renderCopyrightInfo() {
		// 目录状态时不显示文件信息卡片
		if (this.state.showDirectory || !window.app.setting.current_article) {
			return '<div class="copyright-info"></div>';
		}

		const parsed = window.app.parsePath(window.app.setting.current_article);
		const creation = this.state.creation || {};

		return `
			<div class="copyright-info">
				<div class="info-card">
					<div class="info-card-label">${this.t('viewPage.license', '版权许可')}</div>
					<div class="info-card-value">${this.t('viewPage.licenseText', 'DIPCF基金会')}</div>
				</div>
				<div class="info-card">
					<div class="info-card-label">${this.t('viewPage.workName', '作品名')}</div>
					<div class="info-card-value">${this.escapeHtml(creation.name || parsed.repo || '')}</div>
				</div>
				<div class="info-card">
					<div class="info-card-label">${this.t('viewPage.fileName', '文件名')}</div>
					<div class="info-card-value">${this.escapeHtml(parsed.filename || '')}</div>
				</div>
				<div class="info-card">
					<div class="info-card-label">${this.t('viewPage.author', '作者')}</div>
					<div class="info-card-value">${this.escapeHtml(this.state.penName)}</div>
				</div>
				${this.state.version !== null && this.state.version !== undefined ? `
					<div class="info-card">
						<div class="info-card-label">${this.t('viewPage.version', '版本')}</div>
						<div class="info-card-value">${this.escapeHtml(String(this.state.version))}</div>
					</div>
				` : ''}
				${this.state.createTime ? `
					<div class="info-card">
						<div class="info-card-label">${this.t('viewPage.createTime', '创建时间')}</div>
						<div class="info-card-value">${window.I18nService.formatDate(this.state.createTime)}</div>
					</div>
				` : ''}
				${this.state.updateTime ? `
					<div class="info-card">
						<div class="info-card-label">${this.t('viewPage.updateTime', '更新时间')}</div>
						<div class="info-card-value">${window.I18nService.formatDate(this.state.updateTime)}</div>
					</div>
				` : ''}
				${this.state.isAuthor && this.state.article ? `
					<div class="info-card info-card-vote">
						<div class="info-card-label">${this.t('viewPage.likes', '点赞')}</div>
						<div class="info-card-value">👍 ${this.state.article.likes || 0}</div>
					</div>
					<div class="info-card info-card-vote">
						<div class="info-card-label">${this.t('viewPage.hates', '点踩')}</div>
						<div class="info-card-value">👎 ${this.state.article.hates || 0}</div>
					</div>
				` : ''}
			</div>
		`;
	}

	/**
	 * 渲染工具栏
	 * @returns {string} 工具栏HTML字符串
	 */
	renderToolbar() {
		// 目录模式下只显示新建按钮
		if (this.state.showDirectory) {
			return `
				<div class="view-toolbar">
					<button class="toolbar-btn" data-action="add" title="${this.t('viewPage.add', '新建')}">
						➕					
					</button>
				</div>
			`;
		}

		const canGoBack = window.app.setting.read_path_index > 0;
		const canGoForward = window.app.setting.read_path_index < window.app.setting.read_path.length - 1;
		const isAuthor = this.state.isAuthor;
		// 检查是否有版本信息（没有版本信息的文件不能编辑和查看信息）
		const hasVersion = this.state.version !== null && this.state.version !== undefined;

		// 安全地获取投票值，如果article为null则使用默认值
		const vote = this.state.article?.vote !== undefined ? this.state.article.vote : -2;

		return `
			<div class="view-toolbar">
				<button class="toolbar-btn" data-action="back" ${!canGoBack ? 'disabled' : ''} title="${this.t('viewPage.back', '后退')}">
					◀
				</button>
				<button class="toolbar-btn" data-action="forward" ${!canGoForward ? 'disabled' : ''} title="${this.t('viewPage.forward', '前进')}">
					▶
				</button>
				<button class="toolbar-btn" data-action="info" ${!hasVersion ? 'disabled' : ''} title="${this.t('viewPage.info', '信息')}">
					ℹ️
				</button>
				<button class="toolbar-btn" data-action="directory" title="${this.t('viewPage.directory', '目录')}">
					📁
				</button>
				<button class="toolbar-btn" data-action="refresh" ${!window.app.setting.current_article ? 'disabled' : ''} title="${this.t('viewPage.refresh', '刷新')}">
					🔄
				</button>
				<button class="toolbar-btn" data-action="add" ${!hasVersion ? 'disabled' : ''} title="${this.t('viewPage.add', '新建')}">
					➕					
				</button>
				${!isAuthor ? `
					<button class="toolbar-btn vote-btn ${vote === 1 ? 'active' : ''} ${vote === -2 ? 'inactive' : ''}" data-action="like" title="${this.t('viewPage.like', '点赞')}">
						👍
					</button>
					<button class="toolbar-btn vote-btn ${vote === -1 ? 'active' : ''} ${vote === -2 ? 'inactive' : ''}" data-action="hate" title="${this.t('viewPage.hate', '点踩')}">
						👎
					</button>
					<button class="toolbar-btn vote-btn ${vote === 0 ? 'active' : ''} ${vote === -2 ? 'inactive' : ''}" data-action="pass" title="${this.t('viewPage.pass', '路过')}">
						➡️
					</button>
				` : `<button class="toolbar-btn" data-action="edit" ${!hasVersion ? 'disabled' : ''} title="${this.t('viewPage.edit', '编辑')}">
						✏️
					</button>`}
			</div>
		`;
	}

	/**
	 * 渲染主要内容区域
	 * @returns {string} 主内容HTML字符串
	 */
	renderMainContent() {
		if (this.state.loading) {
			return `<div class="loading">${this.t('common.loading', '载入中...')}</div>`;
		}

		// 如果显示目录，优先显示目录
		if (this.state.showDirectory) {
			return this.renderDirectory();
		}

		if (!this.state.article) {
			return `<div class="empty">${this.t('viewPage.noArticle', '暂无文章')}</div>`;
		}

		// 渲染文章内容
		let content = this.renderArticleContent();

		return content;
	}

	/**
	 * 渲染文章内容
	 * @returns {string} 文章内容HTML字符串
	 */
	renderArticleContent() {
		// 使用翻译内容（如果有）
		let content = window.app.parseArticleContent(this.state.article.translation || this.state.article.content).content;
		return this._renderArticleContent(content);
	}

	/**
	 * 渲染目录
	 * @returns {string} 目录HTML字符串
	 */
	renderDirectory() {
		if (!this.state.directoryTree || !this.state.directoryTree.children || this.state.directoryTree.children.length === 0) {
			return `<div class="empty">${this.t('viewPage.noFiles', '暂无文件')}</div>`;
		}

		const renderTree = (node, level = 0) => {
			if (node.type === 'file') {
				return `
					<div class="directory-item directory-file" data-path="${this.escapeHtmlAttribute(node.path)}" style="padding-left: ${level * 20 + 8}px;">
						<span class="file-icon">📄</span>
						<span class="file-name">${this.escapeHtml(node.name)}</span>
					</div>
				`;
			} else {
				// 根目录（level 0）默认展开，子目录默认折叠
				const expanded = level === 0 ? true : (node.expanded === true);
				const childrenHtml = node.children.map(child => renderTree(child, level + 1)).join('');
				return `
					<div class="directory-folder" data-path="${this.escapeHtmlAttribute(node.path || '')}">
						<div class="directory-item directory-dir" data-expanded="${expanded}" style="padding-left: ${level * 20 + 8}px;">
							<span class="folder-icon">${expanded ? '📂' : '📁'}</span>
							<span class="folder-name">${this.escapeHtml(node.name || '')}</span>
						</div>
						<div class="directory-children" style="display: ${expanded ? 'block' : 'none'};">
							${childrenHtml}
						</div>
					</div>
				`;
			}
		};

		const html = this.state.directoryTree.children.map(child => renderTree(child, 0)).join('');
		return `<div class="directory-list">${html}</div>`;
	}

	/**
	 * 加载文章数据
	 * @returns {Promise<void>}
	 */
	async loadArticleData() {
		try {
			this.state.loading = true;
			this.updateDOM(); // 更新加载状态显示

			// 获取当前仓库
			const currentRepo = window.app.setting.current_repo;
			if (!currentRepo) {
				console.error('loadArticleData: 当前仓库为空');
				this.state.loading = false;
				this.state.article = null;
				this.updateDOM();
				return;
			}

			// 验证路径是否属于当前仓库
			if (window.app.setting.current_article) {
				const parsed = window.app.parsePath(window.app.setting.current_article);
				const repoPath = `${parsed.owner}/${parsed.repo}`;
				if (repoPath !== currentRepo) {
					// 重置当前仓库路径
					window.app.setting.current_repo = repoPath;
					window.StorageService.saveKV('setting', window.app.setting);
				}

				// 加载文章
				await this.loadArticle(window.app.setting.current_article);
			} else {
				// 使用当前仓库路径加载目录文件列表
				await this.loadDirectoryFiles();
				this.state.loading = false;
				this.state.article = null;
				this.updateDOM(); // 更新DOM显示空状态或目录
			}
		} catch (error) {
			console.error('加载文章失败:', error);
			this.state.loading = false;
			this.updateDOM();
		}
	}

	/**
	 * 加载目录文件列表
	 * @returns {Promise<void>}
	 */
	async loadDirectoryFiles() {
		try {
			const currentRepo = window.app.setting.current_repo;
			if (!currentRepo) {
				console.error('loadDirectoryFiles: 当前仓库为空');
				return;
			}

			// 直接解析仓库路径（格式：owner/repo）
			const repo = currentRepo.split('/')[1];

			// 从 storage-service 获取文件树
			const tree = await window.StorageService.getRepositoryFiles(repo);
			this.state.directoryTree = tree;
			this.state.showDirectory = true;
		} catch (error) {
			console.error('加载目录文件失败:', error);
		}
	}

	/**
	 * 处理文件数据并更新页面（通用逻辑）
	 * @param {Object} fileData - 文件数据
	 * @param {string} path - 文件路径
	 * @param {Object} options - 选项
	 * @param {boolean} options.skipUpdatePath - 是否跳过更新阅读路径
	 * @returns {Promise<void>}
	 */
	async processFileData(fileData, path, options = {}) {
		const { skipUpdatePath = false } = options;

		// 验证文件数据
		if (!fileData) {
			throw new Error('文件数据为空');
		}

		if (!fileData.content) {
			throw new Error('文件内容为空');
		}

		// 在后台批量下载文本和媒体文件
		const textLinks = window.StorageService.parseTextLinks(fileData.content);
		const mediaLinks = window.StorageService.parseMediaLinks(fileData.content);
		window.StorageService.downloadFiles(textLinks);
		window.StorageService.downloadMediaFiles(mediaLinks);

		// 解析文件内容
		const parsed = window.app.parseArticleContent(fileData.content);

		// 检查是否是作者
		const parsedPath = window.app.parsePath(path);
		const isAuthor = parsedPath.owner === (window.app.user.username || window.app.user.name);

		// 更新阅读路径（如果不是通过后退/前进导航）
		if (!skipUpdatePath) {
			this.updateReadPath(path);
		}

		// 获取作品信息
		const creation = await this.getCreationInfo();

		// 更新状态
		this.state.loading = false;
		this.state.article = fileData;
		this.state.version = parsed.version;
		this.state.updateTime = parsed.updateTime;
		this.state.createTime = parsed.createTime;
		this.state.penName = parsed.penName;
		this.state.isAuthor = isAuthor;
		this.state.creation = creation;

		// 更新DOM以显示内容
		this.updateDOM();

		// 恢复滚动位置
		this.restoreScrollPosition();

		// 加载媒体文件（图片和音频）
		setTimeout(() => {
			this.loadMediaElements();
		}, 100);

		// 自动翻译（如果启用）
		if (window.app.setting.third_party && !fileData.translation) {
			this.autoTranslate(fileData);
		}
	}

	/**
	 * 加载文章
	 * @param {string} path - 文章路径
	 * @param {boolean} skipUpdatePath - 是否跳过更新阅读路径（用于后退/前进导航）
	 */
	async loadArticle(path, skipUpdatePath = false) {
		return new Promise(async (resolve, reject) => {
			try {
				// 保存当前文章的滚动位置
				if (this.state.article && window.app.setting.current_article !== path) {
					await this.saveScrollPosition();
				}

				// 验证路径
				if (!path || !path.endsWith('.md')) {
					console.error('loadArticle: 路径为空');
					this.state.loading = false;
					this.state.article = null;
					this.updateDOM();
					reject(new Error('路径为空'));
					return;
				}

				// 解码 URL 编码的路径（处理中文等特殊字符）
				path = decodeURIComponent(path);

				// 读取文件
				await window.StorageService.readFile(path, async (fileData) => {
					try {
						await this.processFileData(fileData, path, { skipUpdatePath });
						// 成功加载，resolve Promise
						resolve();
					} catch (error) {
						console.error('loadArticle回调中出错:', error);
						this.state.loading = false;
						this.state.article = null;
						this.updateDOM();
						reject(error);
					}
				});
			} catch (error) {
				console.error('加载文章失败:', error, '路径:', path);
				this.state.loading = false;
				this.updateDOM();
				reject(error);
			}
		});
	}

	/**
	 * 获取作品信息
	 * @returns {Promise<Object>} 作品信息
	 */
	async getCreationInfo() {
		return await window.StorageService.execute('creations', 'get', window.app.setting.current_repo);
	}

	/**
	 * 更新阅读路径
	 * @param {string} path - 文章路径
	 */
	updateReadPath(path) {
		let readPath = window.app.setting.read_path || [];
		let readPathIndex = window.app.setting.read_path_index !== undefined ? window.app.setting.read_path_index : -1;

		// 如果当前不在路径末尾，删除后面的路径
		if (readPathIndex < readPath.length - 1) {
			readPath = readPath.slice(0, readPathIndex + 1);
		}

		// 添加新路径
		if (readPath.length === 0 || readPath[readPath.length - 1] !== path) {
			readPath.push(path);
			readPathIndex = readPath.length - 1;
		}

		// 保存到setting
		window.app.setting.read_path = readPath;
		window.app.setting.read_path_index = readPathIndex;
		window.app.setting.current_article = path;
		window.StorageService.saveKV('setting', window.app.setting);
	}

	/**
	 * 恢复滚动位置
	 */
	restoreScrollPosition() {
		const targetScrollTop = this.state.article?.scrollTop;
		if (targetScrollTop !== undefined && targetScrollTop >= 0) {
			requestAnimationFrame(() => {
				setTimeout(() => {
					const contentEl = this.element?.querySelector('.view-content');
					if (contentEl) {
						contentEl.scrollTop = targetScrollTop;
					}
				}, 10);
			});
		} else {
			requestAnimationFrame(() => {
				setTimeout(() => {
					const contentEl = this.element?.querySelector('.view-content');
					if (contentEl) {
						contentEl.scrollTop = 0;
					}
				}, 10);
			});
		}
	}

	/**
	 * 保存滚动位置
	 */
	async saveScrollPosition() {
		const contentEl = this.element?.querySelector('.view-content');
		if (contentEl && this.state.article && window.app.setting.current_article) {
			this.state.article.scrollTop = contentEl.scrollTop;
			await window.StorageService.execute('files', 'put', this.state.article);
		}
	}

	/**
	 * 自动翻译文章
	 * @param {Object} fileData - 文件数据
	 */
	async autoTranslate(fileData) {
		try {
			// 验证文件数据是否匹配当前文章路径
			if (fileData.path !== window.app.setting.current_article) {
				console.warn('autoTranslate: 文件路径不匹配，跳过翻译');
				return;
			}

			await window.StorageService.translateFile(fileData, (result) => {
				if (result.isDone && result.fileData) {
					// 再次验证路径匹配
					if (result.fileData.path === window.app.setting.current_article) {
						this.state.article = result.fileData;
						// 更新翻译后的内容
						if (result.fileData.translation) {
							this.updateDOM();
						}
					} else {
						console.warn('autoTranslate: 翻译结果路径不匹配，忽略更新');
					}
				}
			});
		} catch (error) {
			console.error('自动翻译失败:', error);
		}
	}

	/**
	 * 导航到文章
	 * @param {string} path - 文章路径
	 */
	async navigateToArticle(path) {
		try {
			// 加载文章
			await this.loadArticle(path);

			// 更新DOM
			this.updateDOM();
		} catch (error) {
			await this.goBack();
			// 显示错误提示
			const modal = new window.Modal();
			modal.showInfo(
				this.t('viewPage.errors.error', '错误'),
				this.t('viewPage.errors.fileNotFound', '文件不存在: ') + path,
				{ showCancel: false }
			);

			// 更新DOM以显示回退后的内容
			this.updateDOM();
		}
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		if (!this.element) return;

		// 工具栏按钮事件
		// 先移除旧的事件监听器（如果存在）
		if (this.toolbarBtnHandlers) {
			this.toolbarBtnHandlers.forEach(({ btn, handler }) => {
				btn.removeEventListener('click', handler);
			});
		}

		// 存储新的事件处理器，以便后续移除
		this.toolbarBtnHandlers = [];
		const toolbarBtns = this.element.querySelectorAll('.toolbar-btn');
		toolbarBtns.forEach(btn => {
			const handler = (e) => {
				// 如果按钮被禁用，不执行操作
				if (e.currentTarget.disabled) {
					return;
				}
				const action = e.currentTarget.dataset.action;
				this.handleToolbarAction(action);
			};
			btn.addEventListener('click', handler);
			this.toolbarBtnHandlers.push({ btn, handler });
		});

		// 滚动位置实时更新（不保存到数据库，只更新内存中的状态）
		// 先移除旧的监听器（如果存在）
		if (this.scrollHandler) {
			const oldContentEl = this.element.querySelector('.view-content');
			if (oldContentEl) {
				oldContentEl.removeEventListener('scroll', this.scrollHandler);
			}
		}

		const contentEl = this.element.querySelector('.view-content');
		if (contentEl) {
			let scrollTimeout = null;
			this.scrollHandler = () => {
				if (this.state.article && window.app.setting.current_article) {
					clearTimeout(scrollTimeout);
					scrollTimeout = setTimeout(() => {
						this.state.article.scrollTop = contentEl.scrollTop;
					}, 100);
				}
			};
			contentEl.addEventListener('scroll', this.scrollHandler);
		}

		// 目录项点击事件
		const directoryFiles = this.element.querySelectorAll('.directory-file');
		directoryFiles.forEach(item => {
			item.addEventListener('click', (e) => {
				const path = e.currentTarget.dataset.path;
				if (path) {
					this.loadArticle(path);
					this.state.showDirectory = false;
					this.updateDOM();
				}
			});
		});

		// 目录折叠/展开事件
		const directoryDirs = this.element.querySelectorAll('.directory-dir');
		directoryDirs.forEach(item => {
			item.addEventListener('click', (e) => {
				e.stopPropagation();
				const folder = item.closest('.directory-folder');
				if (folder) {
					const children = folder.querySelector('.directory-children');
					const icon = item.querySelector('.folder-icon');
					const isExpanded = item.dataset.expanded === 'true';

					if (children) {
						if (isExpanded) {
							children.style.display = 'none';
							item.dataset.expanded = 'false';
							if (icon) icon.textContent = '📁';
						} else {
							children.style.display = 'block';
							item.dataset.expanded = 'true';
							if (icon) icon.textContent = '📂';
						}
					}
				}
			});
		});

		this.handlePreviewLink();
	}

	/**
	 * 处理工具栏操作
	 * @param {string} action - 操作类型
	 */
	async handleToolbarAction(action) {
		// 检查是否有版本信息（没有版本信息的文件不能编辑和查看信息）
		const hasVersion = this.state.version !== null && this.state.version !== undefined;
		// 目录模式下允许新建文件，不需要版本信息
		const isDirectoryMode = this.state.showDirectory;

		switch (action) {
			case 'back':
				this.goBack();
				break;
			case 'forward':
				this.goForward();
				break;
			case 'directory':
				this.toggleDirectory();
				break;
			case 'refresh':
				await this.refreshArticle();
				break;
			case 'edit':
				if (!hasVersion) {
					return; // 没有版本信息，不允许编辑
				}
				await this.handleEdit();
				break;
			case 'add':
				// 目录模式下允许新建，不需要版本信息
				if (!isDirectoryMode && !hasVersion) {
					return; // 非目录模式且没有版本信息，不允许新建
				}
				await this.handleAdd();
				break;
			case 'info':
				if (!hasVersion) {
					return; // 没有版本信息，不允许查看信息
				}
				await this.showArticleInfo();
				break;
			case 'like':
				await this.vote(1);
				break;
			case 'hate':
				await this.vote(-1);
				break;
			case 'pass':
				await this.vote(0);
				break;
		}
	}

	/**
	 * 后退
	 */
	async goBack() {
		const readPath = window.app.setting.read_path || [];
		const readPathIndex = window.app.setting.read_path_index || 0;

		if (readPath.length > 0 && readPathIndex >= 0) {
			await this.saveScrollPosition();

			// 如果有之前的页面（索引 > 0），后退到上一个页面
			// 如果索引为 0，仍然加载当前页面（恢复到当前页面）
			let targetIndex = readPathIndex;
			if (readPathIndex > 0) {
				targetIndex = readPathIndex - 1;
			}

			const path = readPath[targetIndex];
			if (path) {
				// 更新状态索引
				window.app.setting.read_path_index = targetIndex;
				window.app.setting.current_article = path;
				window.StorageService.saveKV('setting', window.app.setting);

				// 加载文章，但不更新路径（因为路径已存在）
				await this.loadArticle(path, true);
			}
		}
	}

	/**
	 * 前进
	 */
	async goForward() {
		if (window.app.setting.read_path_index < window.app.setting.read_path.length - 1) {
			await this.saveScrollPosition();

			const newIndex = window.app.setting.read_path_index + 1;
			const path = window.app.setting.read_path[newIndex];

			// 更新状态索引
			window.app.setting.read_path_index = newIndex;
			window.StorageService.saveKV('setting', window.app.setting);

			// 加载文章，但不更新路径（因为路径已存在）
			await this.loadArticle(path, true);
		}
	}

	/**
	 * 切换目录显示
	 */
	async toggleDirectory() {
		if (this.state.showDirectory) {
			this.state.showDirectory = false;
			// 重新载入当前文章路径
			window.app.setting.current_article = window.app.setting.read_path && window.app.setting.read_path.length > 0
				? window.app.setting.read_path[window.app.setting.read_path_index]
				: null;
			window.StorageService.saveKV('setting', window.app.setting);
			await this.loadArticle(window.app.setting.current_article);
		} else {
			this.state.loading = true;
			this.updateDOM();
			await this.loadDirectoryFiles();
			// 删除当前文章路径，因为已经加载了目录
			window.app.setting.current_article = null;
			window.StorageService.saveKV('setting', window.app.setting);
			this.state.showDirectory = true;
			window.app.setting.current_article = null; // 确保不显示文章内容
			this.state.loading = false;
			this.updateDOM();
		}
	}

	/**
	 * 刷新文章（强制从 GitHub 下载最新版本）
	 */
	async refreshArticle() {
		const currentArticle = window.app.setting.current_article;
		if (!currentArticle) {
			return;
		}

		try {
			// 显示加载状态
			this.state.loading = true;
			this.updateDOM();

			// 刷新文件
			const fileData = await window.StorageService.refreshFile(currentArticle);

			// 处理文件数据并更新页面
			await this.processFileData(fileData, currentArticle, { skipUpdatePath: false });
		} catch (error) {
			console.error('刷新文章失败:', error);
			this.state.loading = false;
			this.updateDOM();

			// 显示错误提示
			const modal = new window.Modal();
			modal.showInfo(
				this.t('viewPage.errors.error', '错误'),
				this.t('viewPage.errors.refreshFailed', '刷新失败: ') + error.message,
				{ showCancel: false }
			);
		}
	}

	/**
	 * 显示笔名输入框
	 */
	async showPenNameInput() {
		return new Promise((resolve, reject) => {
			const modal = new window.Modal();
			modal.showInput(
				this.t('common.info', ''),
				this.t('viewPage.penNameInputMessage', '请输入您的笔名'),
				this.t('viewPage.penNameInputPlaceholder', '100字符以内'),
				'',
				(penName) => {
					if (penName && penName.trim()) {
						if (penName.trim().length > 100) {
							reject(new Error('笔名不能超过100个字符'));
							return;
						}
						window.app.user.pen_name = penName.trim();
						window.StorageService.saveKV('user', window.app.user);
						resolve();
					} else {
						reject(new Error('笔名不能为空'));
					}
				}
			);
			modal.onCancel = () => {
				reject(new Error('笔名不能为空'));
			};
		});
	}

	/**
	 * 处理新建操作
	 */
	async handleAdd() {
		if (!window.app.user.pen_name) {
			try {
				await this.showPenNameInput();
			} catch (error) {
				// 用户取消或输入为空，直接返回，不继续执行后续代码
				return;
			}
			// 再次检查笔名是否已设置（防止异步问题）
			if (!window.app.user.pen_name) {
				return;
			}
		}
		// 检查是否已签署CLA
		if (!window.app.user.CLA) {
			await this.showCLAAgreement(
				null,  // 不是根仓库，不需要仓库信息
				async () => {
					// CLA签署成功后，现在才创建仓库
					// 获取根仓库
					const repoInfo = await this.getCreationInfo();
					// 修改作者仓库
					const repo = repoInfo.repository.split('/')[1];
					repoInfo.repository = `${window.app.user.username}/${repo}`;
					repoInfo.repo = repo;
					// 将作者仓库添加到用户作品列表中
					window.app.user.creations.push(repoInfo.repository);
					window.StorageService.saveKV('user', window.app.user);
					console.log('window.app.user', window.app.user.creations);
					// 创建作者仓库
					await this.createRepository(repoInfo, false);
					// 更新当前仓库信息
					window.app.setting.current_repo = repoInfo.repository;
					window.StorageService.saveKV('setting', window.app.setting);
					this.createNewFile();
				}
			);
		} else {
			this.createNewFile();
		}

	}

	/**
	 * 过滤文件路径中的违禁字符并生成完整路径
	 * @param {string} path - 文件路径
	 * @returns {string} 完整路径
	 */
	filterInvalidPathChars(path) {
		if (!path) return '';

		// 违禁字符：Windows 和 Unix 系统文件名中不允许的字符
		// < > : " \ | ? * 以及控制字符（不包括 /，因为 / 是路径分隔符）
		const invalidChars = /[<>:"\\|?*\x00-\x1f]/g;

		// 按路径分隔符分割，分别处理每个路径段
		const parts = path.split('/');
		const filteredParts = parts.map(part => {
			// 过滤每个路径段中的违禁字符
			let filtered = part.replace(invalidChars, '');

			// 移除连续的点（避免 .. 和 . 开头的问题）
			filtered = filtered.replace(/\.{2,}/g, '');

			// 移除路径段开头和结尾的点、空格
			filtered = filtered.replace(/^[\s.]+|[\s.]+$/g, '');

			return filtered;
		}).filter(part => part.length > 0);
		let returnPath = window.app.user.username + "/" + window.app.setting.current_repo.split('/')[1] + "/" + filteredParts.join('/');
		if (!returnPath.endsWith('.md')) {
			returnPath += ".md";
		}
		return returnPath;
	}

	/**
	 * 创建新文件
	 */
	async createNewFile() {
		const modal = new window.Modal();
		modal.showInput(
			this.t('viewPage.createFileTitle', '创建新文件'),
			this.t('viewPage.createFileMessage', '请输入完整的文件路径（包括路径和文件名）'),
			this.t('viewPage.createFilePlaceholder', '例如：人物设定/张三'),
			'',
			(filePath) => {
				if (filePath && filePath.trim()) {
					const trimmed = filePath.trim();
					let filtered = this.filterInvalidPathChars(trimmed);

					// 如果过滤后为空，不跳转
					if (!filtered) {
						return;
					}

					window.app.navigateTo(`/editor?path=${encodeURIComponent(filtered)}`);
				}
			}
		);
	}

	/**
	 * 处理编辑操作
	 */
	async handleEdit() {
		if (!window.app.setting.current_article) {
			return;
		}
		const parsed = window.app.parsePath(window.app.setting.current_article);
		const isOwnArticle = parsed.owner === (window.app.user.username || window.app.user.name);

		if (isOwnArticle) {
			// 编辑模式
			await window.app.navigateTo(`/editor?path=${encodeURIComponent(window.app.setting.current_article)}`);
		}
	}

	/**
	 * 显示文章信息
	 */
	async showArticleInfo() {
		const modal = new window.Modal();
		const infoContent = `
			<div class="work-info-modal">
				<div class="work-info-header">
					<div class="work-info-title">
						<span class="work-icon">📚</span>
						<span class="work-name">${this.escapeHtml(this.state.creation.name || '')}</span>
					</div>
				</div>
				<div class="work-info-stats">
					<div class="stat-group">
						<div class="stat-item">
							<div class="stat-label">${this.t('viewPage.articles', '文章数')}</div>
							<div class="stat-value">${this.state.creation.articles || 0}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">${this.t('viewPage.authors', '作者数')}</div>
							<div class="stat-value">${this.state.creation.authors || 0}</div>
						</div>
						<div class="stat-item">
							<div class="stat-label">${this.t('viewPage.readers', '读者数')}</div>
							<div class="stat-value">${this.state.creation.readers || 0}</div>
						</div>
					</div>
					<div class="stat-group">
						<div class="stat-item stat-like">
							<div class="stat-label">${this.t('viewPage.likes', '点赞数')}</div>
							<div class="stat-value">${this.state.creation.likes || 0}</div>
						</div>
						<div class="stat-item stat-hate">
							<div class="stat-label">${this.t('viewPage.hates', '点踩数')}</div>
							<div class="stat-value">${this.state.creation.hates || 0}</div>
						</div>
						<div class="stat-item stat-pass">
							<div class="stat-label">${this.t('viewPage.pass', '路过')}</div>
							<div class="stat-value">${this.state.creation.pass || 0}</div>
						</div>
					</div>
				</div>
			</div>
		`;

		// 直接使用showInfo，它会自动处理渲染和事件绑定
		modal.showInfo(
			this.t('viewPage.workInfo', '作品信息'),
			infoContent,
			{
				showCancel: false
			}
		);
	}

	/**
	 * 投票
	 * @param {number} vote - 投票值（-1, 0, 1）
	 */
	async vote(vote) {
		if (this.state.isAuthor) {
			return; // 作者不能投票
		}

		try {
			await window.StorageService.voting(window.app.setting.current_article, vote);
			this.state.article.vote = vote;
			this.updateDOM();
		} catch (error) {
			console.error('投票失败:', error);
		}
	}

	/**
	 * 处理页面离开事件
	 */
	async handleBeforeUnload(e) {
		this.saveScrollPosition().catch(() => { });

		// 如果未投票，弹出投票对话框
		if (!this.state.isAuthor && this.state.article.vote === -2) {
			// beforeunload事件中不能使用confirm，只能显示浏览器默认提示
			// 投票功能在页面可见时通过工具栏按钮实现
			e.preventDefault();
			e.returnValue = this.t('viewPage.voteBeforeLeave', '离开前请投票');
			return e.returnValue;
		}
	}

	/**
	 * 更新DOM
	 */
	updateDOM() {
		if (!this.element) return;

		// 更新工具栏
		const toolbar = this.element.querySelector('.view-toolbar');
		if (toolbar) {
			toolbar.outerHTML = this.renderToolbar();
		}

		// 更新版权信息和主内容
		const content = this.element.querySelector('.view-content');
		if (content) {
			content.innerHTML = `
				${this.renderCopyrightInfo()}
				${this.renderMainContent()}
			`;
		}

		// 重新绑定事件（必须在更新DOM之后）
		// 使用 requestAnimationFrame 确保 DOM 更新完成后再绑定事件
		requestAnimationFrame(() => {
			this.bindEvents();
		});

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}

		// 更新固定定位的top值
		this.updateStickyPositions();
	}

	/**
	 * 更新固定定位元素的top值
	 */
	updateStickyPositions() {
		if (!this.element) return;

		// 等待DOM更新完成
		setTimeout(() => {
			const header = this.element.querySelector('.header');
			const toolbar = this.element.querySelector('.view-toolbar');

			if (header && toolbar) {
				const headerHeight = header.offsetHeight;
				toolbar.style.top = `${headerHeight}px`;
			}
		}, 0);
	}

	/**
	 * 注销组件
	 */
	destroy() {
		// 移除页面离开事件监听
		if (this.beforeUnloadHandler) {
			window.removeEventListener('beforeunload', this.beforeUnloadHandler);
		}

		// 断开ResizeObserver
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		this.saveScrollPosition().catch(() => { });

		super.destroy();
	}
}

/**
 * 注册组件到全局
 * @global
 */
window.ViewPage = ViewPage;
