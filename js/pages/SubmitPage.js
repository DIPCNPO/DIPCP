/**
 * 提交页面组件
 * 显示所有待提交的文件，支持勾选和批量提交
 * @class SubmitPage
 * @extends {BasePage}
 */
class SubmitPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.state = {
			loading: true,
			pendingFiles: [], // 待提交文件列表
			selectedFiles: new Set(), // 选中的文件路径集合
			isSubmitting: false, // 是否正在提交
			selectAll: false // 是否全选
		};
	}

	/**
	 * 渲染组件
	 * @returns {HTMLElement} 渲染后的DOM元素
	 */
	async render() {
		// 加载待提交文件列表
		await this.loadPendingFiles();

		const container = document.createElement('div');
		container.className = 'dashboard';

		container.innerHTML = `
			${this.renderHeader()}
			<main class="project-detail-main">
				${this.renderToolbar()}
				<div class="submit-content">
					${this.renderFileList()}
				</div>
			</main>
		`;
		return container;
	}

	/**
	 * 渲染工具栏
	 * @returns {string} 工具栏HTML字符串
	 */
	renderToolbar() {
		const { pendingFiles, selectedFiles, isSubmitting } = this.state;
		const hasSelected = selectedFiles.size > 0;
		const selectedCount = selectedFiles.size;

		return `
			<div class="submit-toolbar">
				<button class="toolbar-btn submit-btn" data-action="submit" 
					${!hasSelected || isSubmitting ? 'disabled' : ''} 
					title="${this.t('submitPage.submit', '批量提交')}">
					${this.t('submitPage.submit', '批量提交')} (${selectedCount})
				</button>
			</div>
		`;
	}

	/**
	 * 渲染文件列表
	 * @returns {string} 文件列表HTML字符串
	 */
	renderFileList() {
		const { loading, pendingFiles, selectedFiles, selectAll } = this.state;

		if (loading) {
			return `<div class="loading">${this.t('common.loading', '载入中...')}</div>`;
		}

		if (pendingFiles.length === 0) {
			return `<div class="empty">${this.t('submitPage.noPendingFiles', '没有待提交的文件')}</div>`;
		}

		const fileItems = pendingFiles.map(pendingFile => {
			const isSelected = selectedFiles.has(pendingFile.path);
			const pathParsed = window.app.parsePath(pendingFile.path);
			const fileType = this.getFileTypeIcon(pathParsed ? pathParsed.extension : '');

			return `
				<div class="submit-file-item" data-path="${this.escapeHtmlAttribute(pendingFile.path)}">
					<label class="submit-file-checkbox">
						<input type="checkbox" ${isSelected ? 'checked' : ''} data-path="${this.escapeHtmlAttribute(pendingFile.path)}">
						<span class="checkbox-label"></span>
					</label>
					<span class="submit-file-icon">${fileType}</span>
					<span class="submit-file-fullpath">${this.escapeHtml(pendingFile.path)}</span>
				</div>
			`;
		}).join('');

		return `
			<div class="submit-file-list">
				<div class="submit-file-header">
					<label class="submit-file-checkbox">
						<input type="checkbox" ${selectAll ? 'checked' : ''} id="select-all-checkbox">
						<span class="checkbox-label"></span>
					</label>
					<span class="submit-file-icon"></span>
					<span class="submit-file-header-fullpath">${this.t('submitPage.filePath', '路径')}</span>
				</div>
				${fileItems}
			</div>
		`;
	}

	/**
	 * 获取文件类型图标
	 * @param {string} extension - 文件扩展名
	 * @returns {string} 图标字符
	 */
	getFileTypeIcon(extension) {
		const iconMap = {
			'md': '📄',
			'jpg': '🖼️',
			'jpeg': '🖼️',
			'png': '🖼️',
			'mp3': '🎵'
		};
		return iconMap[extension?.toLowerCase()] || '📄';
	}

	/**
	 * 加载待提交文件列表
	 * @returns {Promise<void>}
	 */
	async loadPendingFiles() {
		try {
			this.state.loading = true;

			const currentRepo = window.app.setting.current_repo;
			if (!currentRepo) {
				this.state.pendingFiles = [];
				this.state.loading = false;
				return;
			}

			const repoName = currentRepo.split('/')[1];
			const pendingFiles = await window.StorageService.getPendingFiles(repoName);
			this.state.pendingFiles = pendingFiles;
			this.state.selectedFiles = new Set(); // 重置选中状态
			this.state.selectAll = false;
		} catch (error) {
			console.error('加载待提交文件失败:', error);
			this.state.pendingFiles = [];
		} finally {
			this.state.loading = false;
		}
	}

	/**
	 * 组件挂载完成后的回调
	 */
	componentDidMount() {
		this.bindEvents();
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		if (!this.element) return;

		// 工具栏按钮事件
		const toolbarBtns = this.element.querySelectorAll('.toolbar-btn');
		toolbarBtns.forEach(btn => {
			btn.addEventListener('click', (e) => {
				const action = e.currentTarget.dataset.action;
				this.handleToolbarAction(action);
			});
		});

		// 全选复选框
		const selectAllCheckbox = this.element.querySelector('#select-all-checkbox');
		if (selectAllCheckbox) {
			selectAllCheckbox.addEventListener('change', (e) => {
				this.handleSelectAll(e.target.checked);
			});
		}

		// 单个文件复选框
		const fileCheckboxes = this.element.querySelectorAll('.submit-file-item input[type="checkbox"]');
		fileCheckboxes.forEach(checkbox => {
			checkbox.addEventListener('change', (e) => {
				const path = e.target.dataset.path;
				this.handleFileSelect(path, e.target.checked);
			});
		});
	}

	/**
	 * 处理工具栏操作
	 * @param {string} action - 操作类型
	 */
	async handleToolbarAction(action) {
		switch (action) {
			case 'select-all':
				this.handleSelectAll(!this.state.selectAll);
				break;
			case 'submit':
				await this.submitSelectedFiles();
				break;
		}
	}

	/**
	 * 处理全选/取消全选
	 * @param {boolean} checked - 是否选中
	 */
	handleSelectAll(checked) {
		this.state.selectAll = checked;
		this.state.selectedFiles = checked
			? new Set(this.state.pendingFiles.map(f => f.path))
			: new Set();
		this.updateDOM();
	}

	/**
	 * 处理单个文件选择
	 * @param {string} path - 文件路径
	 * @param {boolean} checked - 是否选中
	 */
	handleFileSelect(path, checked) {
		if (checked) {
			this.state.selectedFiles.add(path);
		} else {
			this.state.selectedFiles.delete(path);
		}

		// 更新全选状态
		this.state.selectAll = this.state.selectedFiles.size === this.state.pendingFiles.length;
		this.updateDOM();
	}

	/**
	 * 提交选中的文件
	 * @returns {Promise<void>}
	 */
	async submitSelectedFiles() {
		if (this.state.isSubmitting || this.state.selectedFiles.size === 0) {
			return;
		}

		this.state.isSubmitting = true;
		this.updateDOM();

		// 设置鼠标为等待状态
		const originalCursor = document.body.style.cursor;
		document.body.style.cursor = 'wait';

		try {
			// 获取选中的待提交文件
			const selectedPaths = Array.from(this.state.selectedFiles);
			const filesToSubmit = this.state.pendingFiles.filter(pf => selectedPaths.includes(pf.path));

			// 批量提交文件
			await this.batchSubmitFiles(filesToSubmit);

			// 提交成功后重新加载文件列表
			await this.loadPendingFiles();
			this.updateDOM();
		} catch (error) {
			console.error('提交失败:', error);

			// 获取详细的错误信息
			let errorMessage = error.message || '未知错误';
			const errorStatus = error.status || error.response?.status;

			if (errorStatus === 403) {
				errorMessage = this.t('submitPage.errors.permissionDenied', '权限不足，无法提交文件');
			} else if (errorStatus === 422) {
				errorMessage = this.t('submitPage.errors.conflict', '两次提交的间隔太短，请等1分钟以上再试。');
			} else if (error.message && error.message.includes('PR')) {
				errorMessage = error.message;
			}

			const modal = new window.Modal();
			modal.showInfo(
				this.t('submitPage.errors.error', '错误'),
				this.t('submitPage.errors.submitFailed', '提交失败: ') + errorMessage,
				{ showCancel: false }
			);
		} finally {
			// 恢复鼠标状态
			document.body.style.cursor = originalCursor;
			this.state.isSubmitting = false;
			this.updateDOM();
		}
	}

	/**
	 * 批量提交文件
	 * @param {Array} pendingFiles - 待提交文件列表
	 * @returns {Promise<void>}
	 */
	async batchSubmitFiles(pendingFiles) {
		try {
			const filesToSubmit = [];
			// current_repo 格式：owner/repo（作品仓库，如 minne100/zela_planet）
			// 提交应该到当前用户的仓库：window.app.user.username/repo（如 minne100/zela_planet 或 ZelaCreator/zela_planet）
			const [repoOwner, repoName] = window.app.setting.current_repo.split('/');
			const currentUser = window.app.user.username || window.app.user.name;

			for (const pendingFile of pendingFiles) {
				// 解析文件路径
				const pathParsed = window.app.parsePath(pendingFile.path);
				if (!pathParsed) {
					console.warn('⚠️ 无法解析文件路径:', pendingFile.path);
					continue;
				}

				// 移除路径中的 owner/repo 前缀，保留相对路径
				const filePathPrefix = `${pathParsed.owner}/${pathParsed.repo}/`;
				let relativePath = pendingFile.path;
				if (pendingFile.path.startsWith(filePathPrefix)) {
					relativePath = pendingFile.path.substring(filePathPrefix.length);
				} else {
					// 尝试移除常见的前缀
					const commonPrefixes = [
						`${repoOwner}/${repoName}/`,
						`${currentUser}/${repoName}/`
					];
					for (const prefix of commonPrefixes) {
						if (pendingFile.path.startsWith(prefix)) {
							relativePath = pendingFile.path.substring(prefix.length);
							break;
						}
					}
				}

				// 获取文件内容
				const { extension } = pathParsed;
				if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'mp3') {
					const media = await window.StorageService.execute('medias', 'get', pendingFile.path);
					if (!media || !media.data) {
						console.warn('⚠️ 媒体文件数据为空:', pendingFile.path);
						continue;
					}
					// 将 ArrayBuffer 转换为 base64
					// media.data 是 ArrayBuffer，需要先转换为 Uint8Array，再转换为 base64
					const uint8Array = new Uint8Array(media.data);
					const binaryString = String.fromCharCode.apply(null, uint8Array);
					const base64Content = btoa(binaryString);
					filesToSubmit.push({
						path: relativePath,
						action: 1,
						content: base64Content,
					});
				} else {
					const file = await window.StorageService.execute('files', 'get', pendingFile.path);
					filesToSubmit.push({
						path: relativePath,
						action: 1,
						content: btoa(unescape(encodeURIComponent(file.content))),
					});
				}
			}

			// 批量提交文件到当前用户的仓库
			if (filesToSubmit.length > 0) {
				await this._batchUpdateFiles(currentUser, repoName, filesToSubmit);
			}

			// 只有提交成功后才删除待提交文件
			for (const pendingFile of pendingFiles) {
				await window.StorageService.deletePendingFile(pendingFile.path);
			}
		} catch (error) {
			console.error('批量提交文件失败:', error);
			throw error;
		}
	}

	/**
	 * 批量更新文件
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名
	 * @param {Array} files - 文件数组
	 * @returns {Promise<void>}
	 */
	async _batchUpdateFiles(owner, repo, files) {
		// 使用BasePage的方法进行批量提交
		if (files.length > 0) {
			// 更新的文件使用git操作批量提交
			const remainingFiles = files.map(file => ({
				path: file.path,
				content: file.content
			}));
			// 生成提交消息
			const fileNames = remainingFiles.map(f => f.path.split('/').pop()).join(', ');
			const commitMessage = `批量提交文件: ${fileNames}`;
			await this._createBatchCommit(owner, repo, remainingFiles, commitMessage);
		}
	}

	/**
	 * 更新DOM
	 */
	updateDOM() {
		if (!this.element) return;

		// 更新工具栏
		const toolbar = this.element.querySelector('.submit-toolbar');
		if (toolbar) {
			toolbar.outerHTML = this.renderToolbar();
		}

		// 更新文件列表
		const content = this.element.querySelector('.submit-content');
		if (content) {
			content.innerHTML = this.renderFileList();
		}

		// 重新绑定事件
		requestAnimationFrame(() => {
			this.bindEvents();
		});

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}
	}

	/**
	 * 注销组件
	 */
	destroy() {
		super.destroy();
	}
}

/**
 * 注册组件到全局
 * @global
 */
window.SubmitPage = SubmitPage;

