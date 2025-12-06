/**
 * 链接页面组件
 * 显示自己编写的所有已经提交的文件一览表，支持申请链接
 * @class LinksPage
 * @extends {BasePage}
 */
class LinksPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.state = {
			loading: true,
			myFiles: [], // 自己编写的已提交文件列表
			selectedFile: null // 选中的文件
		};

		// 系统文件名列表（需要过滤的文件）
		this.systemFiles = ['CONTRIBUTING.md', 'LICENSE.md', 'DIPCP.md', 'ABOUT.md', 'CLA.md', 'White_Paper_V2.1.md'];
	}

	/**
	 * 挂载组件到容器
	 * @param {HTMLElement} container - 容器元素
	 * @param {any} path - 路径参数（可选）
	 */
	async mount(container, path = null) {
		await super.mount(container, path);

		// 加载文件列表
		await this.loadMyFiles();

		// 绑定事件
		this.bindEvents();
	}

	/**
	 * 渲染组件
	 * @returns {HTMLElement} 渲染后的DOM元素
	 */
	render() {
		const container = document.createElement('div');
		container.className = 'dashboard';

		container.innerHTML = `
			${this.renderHeader()}
			<main class="project-detail-main">
				<div class="links-content">
					${this.renderFileList()}
				</div>
			</main>
		`;
		return container;
	}

	/**
	 * 渲染文件列表
	 * @returns {string} 文件列表HTML字符串
	 */
	renderFileList() {
		const { loading, myFiles } = this.state;

		if (loading) {
			return `<div class="loading">${this.t('common.loading', '载入中...')}</div>`;
		}

		if (myFiles.length === 0) {
			return `<div class="empty">${this.t('linksPage.noFiles', '没有已提交的文件')}</div>`;
		}

		const fileItems = myFiles.map(file => {
			const pathParsed = window.app.parsePath(file.path);
			let displayPath = file.path;

			if (pathParsed) {
				// 构建显示路径：如果有目录，显示 "目录/文件名"，否则只显示文件名
				if (pathParsed.dirPath) {
					displayPath = `${pathParsed.dirPath}/${pathParsed.fullFilename}`;
				} else {
					displayPath = pathParsed.fullFilename;
				}
			}

			return `
				<div class="links-file-item" data-path="${this.escapeHtmlAttribute(file.path)}">
					<span class="links-file-icon">📄</span>
					<span class="links-file-name">${this.escapeHtml(displayPath)}</span>
					<button class="links-file-action-btn" data-action="request-link" data-path="${this.escapeHtmlAttribute(file.path)}" title="${this.t('linksPage.requestLink', '申请链接')}">
						🔗
					</button>
				</div>
			`;
		}).join('');

		return `
			<div class="links-file-list">
				<div class="links-file-header">
					<span class="links-file-header-icon"></span>
					<span class="links-file-header-name">${this.t('linksPage.fileName', '文件名')}</span>
					<span class="links-file-header-action">${this.t('linksPage.action', '操作')}</span>
				</div>
				${fileItems}
			</div>
		`;
	}

	/**
	 * 加载自己编写的已提交文件列表
	 * @returns {Promise<void>}
	 */
	async loadMyFiles() {
		try {
			this.state.loading = true;

			const currentUser = window.app.user.username || window.app.user.name;
			const currentRepo = window.app.setting.current_repo;
			if (!currentRepo) {
				this.state.myFiles = [];
				this.state.loading = false;
				return;
			}

			// 获取所有文件
			const allFiles = await window.StorageService.execute('files', 'getAll');

			// 获取待提交文件列表（用于过滤）
			const repoName = currentRepo.split('/')[1];
			const pendingFiles = await window.StorageService.getPendingFiles(repoName);
			const pendingPaths = new Set(pendingFiles.map(pf => pf.path));

			// 过滤出自己编写的已提交文件
			this.state.myFiles = allFiles.filter(file => {
				const fileParsed = window.app.parsePath(file.path);
				if (!fileParsed) return false;

				// 是当前用户编写的
				const isMyFile = fileParsed.owner === currentUser;

				// 是当前作品的文件
				const fileRepo = `${fileParsed.owner}/${fileParsed.repo}`;
				const isSameRepo = fileRepo === currentRepo || fileParsed.repo === repoName;

				// 已经提交（不在pending列表中）
				const isSubmitted = !pendingPaths.has(file.path);

				// 是Markdown文件
				const isMarkdown = fileParsed.extension === 'md';

				// 不是系统文件
				const fileFileName = fileParsed.fullFilename || fileParsed.filename || '';
				const isNotSystemFile = !this.systemFiles.includes(fileFileName);

				return isMyFile && isSameRepo && isSubmitted && isMarkdown && isNotSystemFile;
			});

			// 按文件名排序
			this.state.myFiles.sort((a, b) => {
				const aParsed = window.app.parsePath(a.path);
				const bParsed = window.app.parsePath(b.path);
				const aName = aParsed ? aParsed.fullFilename : a.path;
				const bName = bParsed ? bParsed.fullFilename : b.path;
				return aName.localeCompare(bName);
			});

			this.state.loading = false;
			this.updateDOM();
		} catch (error) {
			console.error('加载文件列表失败:', error);
			this.state.loading = false;
			this.updateDOM();
		}
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		if (!this.element) return;

		// 申请链接按钮事件
		const requestLinkBtns = this.element.querySelectorAll('[data-action="request-link"]');
		requestLinkBtns.forEach(btn => {
			if (btn.dataset.bound === 'true') {
				return;
			}
			btn.addEventListener('click', (e) => {
				const filePath = e.currentTarget.dataset.path;
				if (filePath) {
					this.requestLink(filePath);
				}
			});
			btn.dataset.bound = 'true';
		});
	}

	/**
	 * 请求链接（向原作者发送链接申请）
	 * @param {string} filePath - 文件路径
	 * @returns {Promise<void>}
	 */
	async requestLink(filePath) {
		try {
			// 检查是否在pending表中
			const pathParsed = window.app.parsePath(filePath);
			const currentRepo = pathParsed.repo;

			// 获取文件名（不含扩展名）
			const fileName = pathParsed.filename || '';

			// 获取当前作品的所有文件
			const allFiles = await window.StorageService.execute('files', 'getAll');
			const currentUser = window.app.user.username || window.app.user.name;
			const currentRepoFull = `${pathParsed.owner}/${currentRepo}`;

			// 过滤出当前作品的其他作者的文件（还没有建立链接的）
			// 获取所有已建立的链接
			const allLinks = await window.StorageService.execute('links', 'getAll');
			const existingLinks = new Set();
			allLinks.forEach(link => {
				if (link.localPath === filePath) {
					existingLinks.add(link.remotePath);
				}
			});

			// 过滤条件：
			// - 同一作品
			// - 不是当前文章
			// - 不是当前作者
			// - 还没有建立链接
			// - 不是系统文件
			const otherAuthorFiles = allFiles.filter(file => {
				const fileParsed = window.app.parsePath(file.path);
				if (!fileParsed) return false;

				// 不是当前文章
				const isNotCurrentFile = file.path !== filePath;

				// 同一作品
				const fileRepo = `${fileParsed.owner}/${fileParsed.repo}`;
				const isSameRepo = fileRepo === currentRepoFull || fileParsed.repo === currentRepo;

				// 不是当前作者
				const isOtherAuthor = fileParsed.owner !== currentUser;

				// 还没有建立链接
				const notLinked = !existingLinks.has(file.path);

				// 不是系统文件
				const fileFileName = fileParsed.fullFilename || fileParsed.filename || '';
				const isNotSystemFile = !this.systemFiles.includes(fileFileName);
				return isNotCurrentFile && isSameRepo && isOtherAuthor && notLinked && isNotSystemFile;
			});

			if (otherAuthorFiles.length === 0) {
				const modal = new window.Modal();
				modal.showInfo(
					this.t('common.info', '提示'),
					this.t('linksPage.noFilesMessage', '当前作品中没有其他作者未建立链接的文章'),
					{ showCancel: false }
				);
				return;
			}

			// 显示下拉列表模态框
			const modal = new window.Modal();
			const options = otherAuthorFiles.map(file => {
				const fileParsed = window.app.parsePath(file.path);
				const label = `${fileParsed.owner}/${fileParsed.repo}${fileParsed.dirPath ? '/' + fileParsed.dirPath : ''}/${fileParsed.fullFilename}`;
				return { value: file.path, label: label };
			});

			// 选择变化时显示内容并统计同名词语
			let selectedFileData = null;
			const onSelectChange = async (selectedPath) => {
				selectedFileData = otherAuthorFiles.find(f => f.path === selectedPath);
				if (!selectedFileData) return;

				// 获取文件内容
				const content = selectedFileData.content || '';

				// 解析文章内容，去除元数据和作者留言
				const parsed = window.app.parseArticleContent(content);
				let textContent = parsed.content || '';

				// 查找作者留言分隔符
				const messageIndex = textContent.indexOf('-*-*-');
				if (messageIndex !== -1) {
					textContent = textContent.substring(0, messageIndex).trim();
				}

				// 去除Markdown标签和格式
				let plainText = this.stripMarkdown(textContent);

				// 统计当前文件名在内容中出现的次数
				const currentFileNameWithoutExt = fileName.replace(/\.(md)$/i, '');
				const matchCount = this.countWordMatches(plainText, currentFileNameWithoutExt);

				// 更新显示区域
				const contentContainer = modal.element?.querySelector('#modal-select-content');
				if (contentContainer) {
					contentContainer.innerHTML = `
						<div style="margin-bottom: 8px;">
							<strong>${this.t('linksPage.contentPreview', '内容预览')}:</strong>
							<span style="color: var(--text-secondary); font-size: 0.9em; margin-left: 8px;">
								${this.t('linksPage.matchedWords', '匹配到')} <strong>${matchCount}</strong> ${this.t('linksPage.sameNameWords', '个同名词语')}
							</span>
						</div>
						<div style="max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">
							${this.escapeHtml(plainText.substring(0, 1000))}${plainText.length > 1000 ? '...' : ''}
						</div>
					`;
				}
			};

			modal.showSelect(
				this.t('linksPage.selectLinkFile', '选择要链接的文章'),
				this.t('linksPage.selectLinkFileLabel', '请选择当前作品中其他作者的文章：'),
				options,
				onSelectChange,
				async (selectedPath) => {
					// 确认后发送申请
					if (!selectedPath || !selectedFileData) return;

					try {
						const selectedParsed = window.app.parsePath(selectedPath);
						const targetOwner = selectedParsed.owner;
						const targetRepo = selectedParsed.repo;

						const issueTitle = `Link Request: ${fileName}`;
						const issueBody = `**applicant**: ${currentUser}\n` +
							`**request file**: ${filePath}\n` +
							`**link to file**: ${selectedPath}`;

						// 不使用 label，直接创建 Issue
						const createdIssue = await window.GitHubService.createIssue(targetOwner, targetRepo, {
							title: issueTitle,
							body: issueBody
						});

						// 保存到links表
						const linkData = {
							repo: currentRepo,
							localPath: filePath,
							remotePath: selectedPath,
							state: 1 // 1-申请中
						};
						await window.StorageService.execute('links', 'add', linkData);

						// 显示成功提示
						const successModal = new window.Modal();
						successModal.showInfo(
							this.t('common.success', '成功'),
							this.t('linksPage.linkRequestSuccess', '链接申请已发送'),
							{ showCancel: false }
						);

					} catch (error) {
						// 获取错误状态码（支持多种错误格式）
						const statusCode = error.status || error.response?.status || error.response?.statusCode;

						// 根据错误类型提供更友好的错误提示
						let errorMessage = error.message || this.t('linksPage.linkRequestFailed', '发送链接申请失败');

						// 处理 403 权限错误
						if (statusCode === 403 || error.message.includes('权限') || error.message.includes('权限不足')) {
							errorMessage = this.t('linksPage.linkRequestPermissionError', '无法创建链接申请：权限不足。请确保目标仓库已启用 Issues 功能，且您有访问权限。');
						}
						// 处理 404 错误
						else if (statusCode === 404 || error.message.includes('不存在') || error.message.includes('无法访问')) {
							errorMessage = this.t('linksPage.linkRequestNotFoundError', '无法创建链接申请：目标仓库不存在或无法访问。');
						}
						// 其他错误
						else if (error.message) {
							errorMessage = this.t('linksPage.linkRequestFailed', '发送链接申请失败: ') + error.message;
						}

						const errorModal = new window.Modal();
						errorModal.showInfo(
							this.t('common.error', '错误'),
							errorMessage,
							{ showCancel: false }
						);
					}
				},
				options[0]?.value || ''
			);

			// 初始选择第一个选项，等待Modal完全渲染
			if (options.length > 0) {
				setTimeout(() => {
					if (modal.element) {
						onSelectChange(options[0].value);
					}
				}, 200);
			}
		} catch (error) {
			console.error('请求链接失败:', error);
			const modal = new window.Modal();
			modal.showInfo(
				this.t('common.error', '错误'),
				this.t('linksPage.linkRequestFailed', '发送链接申请失败: ') + error.message,
				{ showCancel: false }
			);
		}
	}

	/**
	 * 去除Markdown格式，返回纯文本
	 * @param {string} markdown - Markdown文本
	 * @returns {string} 纯文本
	 */
	stripMarkdown(markdown) {
		if (!markdown) return '';

		let text = markdown;

		// 移除代码块
		text = text.replace(/```[\s\S]*?```/g, '');
		text = text.replace(/`[^`]*`/g, '');

		// 移除链接，保留文本部分
		text = text.replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1');

		// 移除图片
		text = text.replace(/!\[([^\]]*)\]\([^\)]*\)/g, '');

		// 移除HTML标签
		text = text.replace(/<[^>]*>/g, '');

		// 移除Markdown标题标记
		text = text.replace(/^#{1,6}\s+/gm, '');

		// 移除粗体和斜体标记
		text = text.replace(/\*\*([^*]*)\*\*/g, '$1');
		text = text.replace(/\*([^*]*)\*/g, '$1');
		text = text.replace(/__([^_]*)__/g, '$1');
		text = text.replace(/_([^_]*)_/g, '$1');

		// 移除列表标记
		text = text.replace(/^[\*\-\+]\s+/gm, '');
		text = text.replace(/^\d+\.\s+/gm, '');

		// 移除引用标记
		text = text.replace(/^>\s+/gm, '');

		// 移除水平线
		text = text.replace(/^[-*_]{3,}$/gm, '');

		// 移除多余的空白行
		text = text.replace(/\n{3,}/g, '\n\n');

		return text.trim();
	}

	/**
	 * 统计文本中匹配词语的数量（不区分大小写，直接匹配，不使用单词边界）
	 * @param {string} text - 文本内容
	 * @param {string} word - 要匹配的词语（可以是完整文件名，方法会自动去除扩展名）
	 * @returns {number} 匹配次数
	 */
	countWordMatches(text, word) {
		if (!text || !word) return 0;

		// 转义正则表达式特殊字符
		const escapedName = this.escapeRegex(word);

		// 直接匹配，不使用单词边界
		// 使用全局匹配和不区分大小写
		const regex = new RegExp(escapedName, 'gi');

		// 重置 lastIndex 确保匹配正确
		regex.lastIndex = 0;
		const matches = text.match(regex);

		return matches ? matches.length : 0;
	}

	/**
	 * 转义正则表达式特殊字符
	 * @param {string} str - 要转义的字符串
	 * @returns {string} 转义后的字符串
	 */
	escapeRegex(str) {
		if (typeof str !== 'string') {
			return '';
		}
		// 转义正则表达式特殊字符
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * 更新DOM
	 */
	updateDOM() {
		if (!this.element) return;

		// 更新文件列表
		const contentArea = this.element.querySelector('.links-content');
		if (contentArea) {
			contentArea.innerHTML = this.renderFileList();
		}

		// 重新绑定事件
		this.bindEvents();

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}
	}

	/**
	 * 注销组件
	 */
	destroy() {
		// 调用父类销毁方法
		super.destroy();
	}
}

// 注册组件
window.LinksPage = LinksPage;

