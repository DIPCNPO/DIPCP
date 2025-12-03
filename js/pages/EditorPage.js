/**
 * 编辑器页面组件
 * 完全组件化的编辑器页面，提供文件编辑、预览、保存等功能
 * @class EditorPage
 * @extends {BasePage}
 */
class EditorPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.state = {
			mode: 'edit', // 'edit' 或 'create'
			filePath: null,
			fileName: '',
			workName: '',
			content: '',
			authorMessage: '',
			header: '',
			isPreview: false,
			autoSaveTimer: null,
			linkSelections: {}, // 存储用户选择的链接引用
			previewHistory: [], // 预览模式下的链接导航历史
			previewHistoryIndex: -1, // 当前预览历史索引
			previewContent: '', // 当前预览的内容
			hasUnsavedChanges: false, // 是否有未保存的更改
			savedContent: '', // 保存时的内容
			savedAuthorMessage: '', // 保存时的作者留言
		};
		this.editorRef = null;
		this.authorMessageRef = null;
		this.toolbarButtonHandler = this.onToolbarButtonClick.bind(this);
		this.authorMessageInputHandler = this.onAuthorMessageInput.bind(this);
	}

	/**
	 * 挂载组件到容器
	 * @param {HTMLElement} container - 容器元素
	 * @param {any} path - 路径参数（可选）
	 */
	async mount(container, path = null) {
		await super.mount(container, path);

		// 解析查询参数
		const url = new URL(window.location.href);
		const filePath = url.searchParams.get('path') || '';

		this.state.filePath = filePath;

		// 加载文件数据
		await this.loadFileData();

		// 绑定事件
		this.bindEvents();

		// 初始化自动保存
		this.initAutoSave();

		// 更新固定定位
		this.updateStickyPositions();
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
				${this.renderToolbar()}
				<div class="editor-content">
					${this.renderTitleArea()}
					${this.renderMainContent()}
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
		// 预览模式下显示前进/后退，编辑模式下显示撤销/反撤销
		let navButtons = '';
		if (this.state.isPreview) {
			const canGoBack = this.state.previewHistoryIndex > 0;
			const canGoForward = this.state.previewHistoryIndex < this.state.previewHistory.length - 1;
			navButtons = `
				<button class="toolbar-btn" data-action="preview-back" ${!canGoBack ? 'disabled' : ''} title="${this.t('viewPage.back', '后退')}">
					◀
				</button>
				<button class="toolbar-btn" data-action="preview-forward" ${!canGoForward ? 'disabled' : ''} title="${this.t('viewPage.forward', '前进')}">
					▶
				</button>
				<button class="toolbar-btn" data-action="preview" title="${this.t('viewPage.edit', '编辑')}">
					✏️
				</button>
			`;
		} else {
			// CodeMirror 的撤销/重做状态会在 updateToolbarButtons 中更新
			navButtons = `
				<button class="toolbar-btn" data-action="undo" disabled title="${this.t('editorPage.undo', '撤销')}">
					↶
				</button>
				<button class="toolbar-btn" data-action="redo" disabled title="${this.t('editorPage.redo', '反撤销')}">
					↷
				</button>
				<button class="toolbar-btn" data-action="preview" title="${this.t('editorPage.preview', '预览')}">
					👁️
				</button>
				<button class="toolbar-btn" data-action="save" title="${this.t('editorPage.save', '保存')}">
					💾
				</button>
				<button class="toolbar-btn" data-action="delete" title="${this.t('editorPage.delete', '删除')}">
					🗑️
				</button>
				<button class="toolbar-btn" data-action="upload" title="${this.t('editorPage.upload', '上传')}">
					📤
				</button>
				<button class="toolbar-btn" data-action="link" title="${this.t('editorPage.link', '链接')}">
					🔗
				</button>
			`;
		}

		return `
			<div class="view-toolbar">
				${navButtons}
			</div>
		`;
	}

	/**
	 * 渲染标题区
	 * @returns {string} 标题区HTML字符串
	 */
	renderTitleArea() {
		// 如果有未保存的更改，在文件名后添加 *
		const unsavedMarker = this.state.hasUnsavedChanges ? '*' : '';

		return `
			<div class="editor-title-area">
				<div class="editor-work-name">${this.escapeHtml(this.state.workName || '')}</div>
				<div class="editor-file-name">
					<span class="editor-filename-display">${this.escapeHtml(this.state.filePath)}${unsavedMarker}</span>
				</div>
			</div>
		`;
	}

	/**
	 * 渲染主内容区
	 * @returns {string} 主内容HTML字符串
	 */
	renderMainContent() {
		if (this.state.isPreview) {
			return this.renderPreview();
		}

		return `
			<div class="editor-panel">
				<div class="editor-content-area">
					<div id="editor-textarea-container"></div>
				</div>
				<div class="editor-message-area">
					<label class="editor-message-label">${this.t('editorPage.authorMessage', '作者留言')}</label>
					<textarea 
						class="editor-message-textarea" 
						id="editor-message-textarea"
						placeholder="${this.tAttr('editorPage.messagePlaceholder', '请输入作者留言...')}"
					>${this.escapeHtml(this.state.authorMessage)}</textarea>
				</div>
			</div>
		`;
	}

	/**
	 * 渲染预览区
	 * @returns {string} 预览HTML字符串
	 */
	renderPreview() {
		// 使用预览内容（可能是当前内容或链接内容）
		const contentToPreview = this.state.previewContent || this.state.content;
		const articleContent = this._renderArticleContent(contentToPreview);
		// 包装在一个可滚动的容器中
		return `<div class="editor-preview" style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow-y: auto; overflow-x: hidden;">${articleContent}</div>`;
	}

	/**
	 * 构建完整内容(包含元数据)
	 * @param {string} content - 已替换链接的内容
	 * @param {boolean} autosave - 是否为自动保存
	 * @returns {string} 完整内容
	 */
	buildFullContent(content, autosave = false) {
		if (!autosave) {
			let { version, updateTime, createTime } = window.app.parseArticleContent(this.state.header);
			version = parseInt(version) + 1;
			updateTime = new Date().toISOString();
			if (!createTime) createTime = updateTime;
			this.state.header = `pen_name:${window.app.user.pen_name}\nversion:${version}\nupdate_time:${updateTime}\ncreate_time:${createTime}\n`;
		}

		content = this.state.header + content;

		if (this.state.authorMessage) {
			content += '\n-*-*-\n' + this.state.authorMessage;
		}

		return content;
	}

	/**
	 * 加载文件数据
	 * 根据文件是否存在自动判断是 edit 模式还是 create 模式
	 * @returns {Promise<void>}
	 */
	async loadFileData() {
		try {
			// 获取作品名
			const creation = await window.StorageService.execute('creations', 'get', window.app.setting.current_repo);
			this.state.workName = creation?.name;

			// 检查文件是否存在
			const existingFile = await window.StorageService.execute('files', 'get', this.state.filePath).catch(() => null);

			if (existingFile) {
				// 文件存在，使用 edit 模式
				this.state.mode = 'edit';
				const parsed = window.app.parseArticleContent(existingFile.content);
				const pathParsed = window.app.parsePath(this.state.filePath);

				this.state.fileName = pathParsed.filename || '';

				// 从内容中分离作者留言（parseArticleContent 不处理 -*-*- 分隔符）
				let content = parsed.content || '';
				let authorMessage = '';

				// 查找 -*-*- 分隔符
				const messageIndex = content.indexOf('-*-*-');
				if (messageIndex !== -1) {
					// 分离主内容和作者留言
					authorMessage = content.substring(messageIndex + 6).trim(); // 6 是 '-*-*-' 的长度
					content = content.substring(0, messageIndex).trim();
				}

				this.state.content = content;
				this.state.authorMessage = authorMessage;
				this.state.header = parsed.header + "\n";

				// 保存原始内容状态，用于检测未保存更改
				this.state.savedContent = this.state.content;
				this.state.savedAuthorMessage = this.state.authorMessage;
				this.state.hasUnsavedChanges = false;

				this.updateDOM();
				this.restoreCursorPosition();

			} else {
				// 文件不存在，使用 create 模式
				this.state.mode = 'create';
				const pathParsed = window.app.parsePath(this.state.filePath);
				this.state.fileName = pathParsed.filename || '';
				// 初始化保存状态
				this.state.content = '';
				this.state.authorMessage = '';
				this.state.header = `pen_name:${window.app.user.pen_name}\nversion:0\nupdate_time:\ncreate_time:\n`;
				this.state.hasUnsavedChanges = false;
				this.updateDOM();
			}
		} catch (error) {
			console.error('加载文件数据失败:', error);
		}
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		if (!this.element) return;

		// 工具栏按钮事件
		const toolbarBtns = this.element.querySelectorAll('.toolbar-btn');
		toolbarBtns.forEach(btn => {
			if (btn.dataset.bound === 'true') {
				return;
			}
			btn.addEventListener('click', this.toolbarButtonHandler);
			btn.dataset.bound = 'true';
		});

		// 初始化 CodeMirror 编辑器
		const editorContainer = this.element.querySelector('#editor-textarea-container');
		if (editorContainer && window.CodeMirror) {
			// 如果已经存在编辑器实例，先销毁它
			if (this.editorRef) {
				// 销毁旧实例
				if (this.editorRef.toTextArea) {
					this.editorRef.toTextArea();
				} else {
					// 如果 toTextArea 不存在，直接清理容器
					editorContainer.innerHTML = '';
				}
				this.editorRef = null;
			}

			// 创建 CodeMirror 实例
			this.editorRef = window.CodeMirror(editorContainer, {
				value: this.state.content,
				mode: 'markdown',
				lineNumbers: false,
				lineWrapping: true,
				placeholder: this.t('editorPage.contentPlaceholder', '请输入文章内容...'),
				autofocus: false,
				// 启用撤销/重做功能
				undoDepth: 50,
				// 支持中文输入法
				inputStyle: 'contenteditable'
			});

			// 监听内容变化
			this.editorRef.on('change', (cm, change) => {
				const newContent = cm.getValue();
				this.state.content = newContent;
				// 检查是否有未保存的更改
				this.checkUnsavedChanges();
			});

			// 监听撤销/重做历史变化，更新工具栏按钮状态
			this.editorRef.on('historyUpdate', () => {
				this.updateToolbarButtons();
			});

			// 快捷键：Ctrl+S 保存
			this.editorRef.setOption('extraKeys', {
				'Ctrl-S': (cm) => {
					// 快捷键保存和自动保存一样，不做链接转化
					this.autoSave();
				},
				'Cmd-S': (cm) => {
					this.autoSave();
				}
			});

			// 初始化工具栏按钮状态
			this.updateToolbarButtons();
		}

		// 作者留言变化事件
		const messageTextarea = this.element.querySelector('#editor-message-textarea');
		if (messageTextarea) {
			this.authorMessageRef = messageTextarea;
			// 确保留言框的值与 state 同步
			if (messageTextarea.value !== this.state.authorMessage) {
				messageTextarea.value = this.state.authorMessage || '';
			}
			if (messageTextarea.dataset.bound !== 'true') {
				messageTextarea.addEventListener('input', this.authorMessageInputHandler);
				messageTextarea.dataset.bound = 'true';
			}
		}

		// 文件上传(隐藏input)
		// 如果已经存在，直接跳过
		if (!this.fileInputRef || !this.fileInputRef.parentNode) {
			const fileInput = document.createElement('input');
			fileInput.type = 'file';
			fileInput.accept = '.txt,.md,.jpg,.jpeg,.png,.mp3';
			fileInput.style.display = 'none';
			fileInput.addEventListener('change', (e) => {
				this.handleFileUpload(e.target.files);
				e.target.value = ''; // 重置input
			});
			this.fileInputRef = fileInput;
			document.body.appendChild(fileInput);
		}

		// 预览模式下的链接点击事件
		if (this.state.isPreview) {
			this.handlePreviewLink();
		}
	}

	/**
	 * 工具栏按钮点击回调（确保只绑定一次）
	 * @param {MouseEvent} e
	 */
	onToolbarButtonClick(e) {
		if (!e || !e.currentTarget || e.currentTarget.disabled) return;
		const action = e.currentTarget.dataset.action;
		if (action) {
			this.handleToolbarAction(action);
		}
	}

	/**
	 * 作者留言输入回调（确保只绑定一次）
	 * @param {InputEvent} e
	 */
	onAuthorMessageInput(e) {
		this.state.authorMessage = e.target.value;
		this.checkUnsavedChanges();
	}

	/**
	 * 处理工具栏操作
	 * @param {string} action - 操作类型
	 */
	async handleToolbarAction(action) {
		switch (action) {
			case 'undo':
				this.undo();
				break;
			case 'redo':
				this.redo();
				break;
			case 'save':
				await this.save();
				break;
			case 'preview':
				this.togglePreview();
				break;
			case 'delete':
				await this.deleteFile();
				break;
			case 'upload':
				this.triggerFileUpload();
				break;
			case 'preview-back':
				this.previewBack();
				break;
			case 'preview-forward':
				this.previewForward();
				break;
			case 'link':
				this.requestLink();
				break;
		}
	}

	/**
	 * 检查是否有未保存的更改
	 */
	checkUnsavedChanges() {
		const hasContentChanged = this.state.content !== this.state.savedContent;
		const hasMessageChanged = this.state.authorMessage !== this.state.savedAuthorMessage;
		this.state.hasUnsavedChanges = hasContentChanged || hasMessageChanged;

		// 更新标题区显示
		const titleArea = this.element?.querySelector('.editor-title-area');
		if (titleArea) {
			titleArea.outerHTML = this.renderTitleArea();
		}

		// 更新工具栏按钮状态（特别是撤销/重做按钮）
		this.updateToolbarButtons();
	}

	/**
	 * 更新工具栏按钮状态
	 */
	updateToolbarButtons() {
		if (!this.element) return;

		const toolbar = this.element.querySelector('.view-toolbar');
		if (!toolbar) return;

		// 只在编辑模式下更新撤销/重做按钮
		if (!this.state.isPreview && this.editorRef && this.editorRef.getHistory) {
			const undoBtn = toolbar.querySelector('[data-action="undo"]');
			const redoBtn = toolbar.querySelector('[data-action="redo"]');

			if (undoBtn || redoBtn) {
				// 使用 CodeMirror 的历史记录 API
				const historySize = this.editorRef.getHistory();
				const canUndo = historySize && historySize.done && historySize.done.length > 0;
				const canRedo = historySize && historySize.undone && historySize.undone.length > 0;

				if (undoBtn) {
					undoBtn.disabled = !canUndo;
				}

				if (redoBtn) {
					redoBtn.disabled = !canRedo;
				}
			}
		}

		// 更新提交按钮状态
	}


	/**
	 * 设置光标等待状态
	 * @param {boolean} waiting - 是否等待
	 */
	setCursorWaiting(waiting) {
		if (!this.element) return;

		if (waiting) {
			document.body.style.cursor = 'wait';
			this.element.style.cursor = 'wait';
		} else {
			document.body.style.cursor = '';
			this.element.style.cursor = '';
		}
	}

	/**
	 * 撤销
	 */
	undo() {
		if (this.editorRef && this.editorRef.undo) {
			this.editorRef.undo();
			// 更新内容状态
			this.state.content = this.editorRef.getValue();
			// 检查是否有未保存的更改
			this.checkUnsavedChanges();
		}
	}

	/**
	 * 反撤销
	 */
	redo() {
		if (this.editorRef && this.editorRef.redo) {
			this.editorRef.redo();
			// 更新内容状态
			this.state.content = this.editorRef.getValue();
			// 检查是否有未保存的更改
			this.checkUnsavedChanges();
		}
	}

	/**
	 * 保存
	 * @returns {Promise<void>}
	 */
	async save() {
		try {
			// 替换文件名为链接
			const contentWithLinks = await this.replaceFileNamesWithLinks(this.state.content);

			// 构建完整内容
			let fullContent = this.buildFullContent(contentWithLinks);
			// 保存到本地
			await window.StorageService.saveFile(this.state.filePath, fullContent);

			// 标记为待提交
			console.log('🔍 [save] 准备保存待提交文件:', this.state.filePath);
			await window.StorageService.savePendingFile(this.state.filePath);
			console.log('🔍 [save] 待提交文件已保存');

			// 将处理好的内容（包含链接）更新到编辑器显示
			this.state.content = contentWithLinks;
			if (this.editorRef && this.editorRef.setValue) {
				this.editorRef.setValue(contentWithLinks);
			}

			// 清除未保存标记，保存当前内容状态
			this.state.hasUnsavedChanges = false;
			this.state.savedContent = contentWithLinks;
			this.state.savedAuthorMessage = this.state.authorMessage;

			// 更新标题区
			const titleArea = this.element?.querySelector('.editor-title-area');
			if (titleArea) {
				titleArea.outerHTML = this.renderTitleArea();
			}

		} catch (error) {
			console.error('保存失败:', error);
		}
	}

	/**
	 * 替换正文中的文件名为链接
	 * @param {string} content - 原始内容
	 * @returns {Promise<string>} 替换后的内容
	 */
	async replaceFileNamesWithLinks(content) {
		// 辅助函数：找到所有Markdown链接的范围
		const findMarkdownLinkRanges = (text) => {
			const ranges = [];
			const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
			let match;

			while ((match = linkRegex.exec(text)) !== null) {
				ranges.push({
					start: match.index,
					end: match.index + match[0].length
				});
			}

			return ranges;
		};

		// 辅助函数：检查位置是否在给定的范围内
		const isPositionInRanges = (start, end, ranges) => {
			return ranges.some(range => start >= range.start && end <= range.end);
		};

		// 获取所有文件
		const db = await window.StorageService.initDB();
		const transaction = db.transaction(['files'], 'readonly');
		const store = transaction.objectStore('files');
		const request = store.getAll();

		const allFiles = await new Promise((resolve, reject) => {
			request.onsuccess = () => resolve(request.result || []);
			request.onerror = () => reject(request.error);
		});

		// 按文件名分组
		const filesByFileName = {};
		allFiles.forEach(file => {
			const fileName = file.filename || '';
			if (!filesByFileName[fileName]) {
				filesByFileName[fileName] = [];
			}
			filesByFileName[fileName].push(file);
		});

		// 替换内容中的文件名
		let result = content;
		const currentUser = window.app.user.username || window.app.user.name;
		const currentRepo = window.app.setting?.current_repo || ''; // 格式：owner/repo

		// 获取当前正在编辑的文件名（不含扩展名），用于排除对自己的引用
		const currentFileName = this.state.fileName || '';
		const currentNameWithoutExt = currentFileName.replace(/\.(md)$/i, '');

		// 对于每个文件名，查找内容中的匹配
		for (const [fileName, files] of Object.entries(filesByFileName)) {
			if (!fileName || fileName.length === 0) continue;

			// 构建正则表达式，匹配单词边界内的文件名(不含扩展名)
			const nameWithoutExt = fileName.replace(/\.(md)$/i, '');
			if (!nameWithoutExt || nameWithoutExt.length === 0) continue;

			// 如果是要替换的文件名与当前文件名相同，跳过（不添加对自己的引用链接）
			if (nameWithoutExt === currentNameWithoutExt) {
				continue;
			}

			// 构建正则表达式
			// 对于所有字符：直接匹配文件名（不含扩展名），不限制边界
			// 通过后续的isExactBracketEnclosed检查来排除链接内的匹配
			const escapedName = this.escapeRegex(nameWithoutExt);
			const regexPattern = escapedName;

			const regex = new RegExp(regexPattern, 'g');

			// 检查是否有匹配（需要重置 lastIndex）
			regex.lastIndex = 0;
			const testMatch = regex.exec(result);
			regex.lastIndex = 0; // 重置以便后续使用

			if (testMatch) {
				// 首先过滤：只选择相同仓库的文件
				const sameRepoFiles = files.filter(f => {
					const parsed = window.app.parsePath(f.path);
					if (!parsed) return false;
					const fileRepo = `${parsed.owner}/${parsed.repo}`;
					return fileRepo === currentRepo;
				});

				if (sameRepoFiles.length === 0) {
					continue;
				}

				// 在相同仓库的文件中，分离自己的文件和别人的文件
				const ownFiles = sameRepoFiles.filter(f => {
					const parsed = window.app.parsePath(f.path);
					return parsed && parsed.owner === currentUser;
				});
				const otherFiles = sameRepoFiles.filter(f => {
					const parsed = window.app.parsePath(f.path);
					return parsed && parsed.owner !== currentUser;
				});

				let selectedFile = null;

				// 优先选择自己的文件
				if (ownFiles.length > 0) {
					selectedFile = ownFiles[0];
				} else if (otherFiles.length === 1) {
					// 只有一个别人的文件，直接使用
					selectedFile = otherFiles[0];
				} else if (otherFiles.length > 1) {
					// 多个文件，检查之前的选择
					const prevSelection = this.state.linkSelections[fileName];
					if (prevSelection) {
						selectedFile = files.find(f => f.path === prevSelection);
					}

					// 如果之前没有选择或选择无效，让用户选择
					if (!selectedFile) {
						selectedFile = await this.selectFileLink(fileName, otherFiles);
						if (selectedFile) {
							this.state.linkSelections[fileName] = selectedFile.path;
						}
					}
				}

				// 如果找到了文件，替换为链接
				if (selectedFile) {
					const parsed = window.app.parsePath(selectedFile.path);
					if (!parsed) {
						continue;
					}

					// 构建完整路径：owner/repo/dirPath/filename.md
					const pathParts = [parsed.owner, parsed.repo];
					if (parsed.dirPath) {
						pathParts.push(parsed.dirPath);
					}
					pathParts.push(parsed.fullFilename);
					const fullPath = pathParts.join('/');

					const linkMarkdown = `[${nameWithoutExt}](${fullPath})`;

					// 找到所有Markdown链接的范围（每次处理前重新计算，因为result可能已改变）
					const linkRanges = findMarkdownLinkRanges(result);

					// 使用替换函数，跳过链接内部的匹配
					// 需要从后往前处理，避免替换后位置偏移
					const matches = [];
					regex.lastIndex = 0;
					let match;
					while ((match = regex.exec(result)) !== null) {
						const matchStart = match.index;
						const matchEnd = matchStart + match[0].length;

						// 检查这个匹配是否在Markdown链接范围内
						const isInLink = isPositionInRanges(matchStart, matchEnd, linkRanges);

						if (!isInLink) {
							// 不在链接内部，记录需要替换的位置
							matches.push({ start: matchStart, end: matchEnd, match: match[0] });
						}
					}

					// 从后往前替换，避免位置偏移
					for (let i = matches.length - 1; i >= 0; i--) {
						const { start, end, match: matchText } = matches[i];
						result = result.substring(0, start) + linkMarkdown + result.substring(end);
					}
				}
			}
		}

		return result;
	}

	/**
	 * 有多个同名文件时引用对象
	 * @param {string} fileName - 文件名
	 * @param {Array} files - 文件列表
	 * @returns {Promise<Object|null>} 选中的文件
	 */
	async selectFileLink(fileName, files) {
		return new Promise((resolve) => {
			const modal = new window.Modal();
			const optionsHtml = files.map((file, index) => {
				const parsed = window.app.parsePath(file.path);
				return `<option value="${index}">${this.escapeHtml(parsed.owner + '/' + parsed.repo + '/' + (parsed.dirPath ? parsed.dirPath + '/' : '') + file.filename)}</option>`;
			}).join('');

			const selectHtml = `
				<div class="form-group">
					<label>${this.t('editorPage.selectFileLink', '选择文件链接')}: ${this.escapeHtml(fileName)}</label>
					<select id="file-link-select" style="width: 100%; padding: 8px;">
						${optionsHtml}
					</select>
				</div>
			`;

			modal.showInfo(
				this.t('editorPage.selectLink', '选择链接'),
				selectHtml,
				{
					showCancel: true
				}
			);

			const modalElement = modal.element;
			if (modalElement) {
				const selectEl = modalElement.querySelector('#file-link-select');
				const confirmBtn = modalElement.querySelector('#modal-confirm');

				if (confirmBtn) {
					const handleConfirm = () => {
						if (selectEl) {
							const selectedIndex = parseInt(selectEl.value);
							resolve(files[selectedIndex] || null);
						} else {
							resolve(null);
						}
						modal.hide();
					};

					confirmBtn.addEventListener('click', handleConfirm, { once: true });
				}

				// 取消时返回null
				const cancelBtn = modalElement.querySelector('#modal-cancel');
				if (cancelBtn) {
					cancelBtn.addEventListener('click', () => {
						resolve(null);
						modal.hide();
					}, { once: true });
				}
			} else {
				resolve(null);
			}
		});
	}

	/**
	 * 初始化自动保存
	 */
	initAutoSave() {
		// 清除之前的定时器
		if (this.state.autoSaveTimer) {
			clearInterval(this.state.autoSaveTimer);
		}

		// 每30秒自动保存
		this.state.autoSaveTimer = setInterval(async () => {
			await this.autoSave();
		}, 30000);
	}


	/**
	 * 自动保存
	 * @returns {Promise<void>}
	 */
	async autoSave() {
		if (!this.state.hasUnsavedChanges) {
			return;
		}
		try {
			// 构建完整内容（不替换链接，只保存原始内容）
			const fullContent = this.buildFullContent(this.state.content, true);

			// 保存到本地
			await window.StorageService.saveFile(this.state.filePath, fullContent);

		} catch (error) {
			console.error('自动保存失败:', error);
		}
	}

	/**
	 * 切换预览
	 */
	togglePreview() {
		this.state.isPreview = !this.state.isPreview;

		// 进入预览模式时，初始化预览历史
		if (this.state.isPreview) {
			// 将当前内容作为第一个预览历史
			if (this.state.previewHistory.length === 0) {
				this.state.previewHistory = [{ type: 'content', content: this.state.content }];
				this.state.previewHistoryIndex = 0;
			}
			this.state.previewContent = this.state.content;
		} else {
			// 退出预览模式时，重置预览历史
			this.state.previewHistory = [];
			this.state.previewHistoryIndex = -1;
			this.state.previewContent = '';
		}

		this.updateDOM();
	}

	/**
	 * 导航到文章
	 * @param {string} path - 文章路径
	 */
	async navigateToArticle(path) {
		if (!this.state.isPreview || !path || !path.endsWith('.md')) return;

		// 解码 URL 编码的路径（处理中文等特殊字符）
		path = decodeURIComponent(path);

		try {
			// 加载链接文件
			await window.StorageService.readFile(path, async (fileData) => {
				if (!fileData || !fileData.content) {
					// 文件不存在，退回之前的页面
					if (this.state.previewHistoryIndex > 0) {
						this.previewBack();
					}

					// 显示错误提示
					const modal = new window.Modal();
					modal.showInfo(
						this.t('editorPage.errors.error', '错误'),
						this.t('editorPage.errors.fileNotFound', '文件不存在: ') + path,
						{ showCancel: false }
					);
					return;
				}

				// 解析文件内容，跳过元数据
				const parsed = window.app.parseArticleContent(fileData.content);
				const content = parsed.content;

				// 更新预览历史
				// 如果当前不在历史末尾，删除后面的历史
				if (this.state.previewHistoryIndex < this.state.previewHistory.length - 1) {
					this.state.previewHistory = this.state.previewHistory.slice(0, this.state.previewHistoryIndex + 1);
				}

				// 添加新的预览历史
				this.state.previewHistory.push({ type: 'link', path: path, content: content });
				this.state.previewHistoryIndex = this.state.previewHistory.length - 1;
				this.state.previewContent = content;

				// 更新DOM
				this.updateDOM();
			});
		} catch (error) {
			// 读取文件失败，退回之前的页面
			if (this.state.previewHistoryIndex > 0) {
				this.previewBack();
			}

			// 显示错误提示
			const modal = new window.Modal();
			modal.showInfo(
				this.t('editorPage.errors.error', '错误'),
				this.t('editorPage.errors.fileNotFound', '文件不存在'),
				{ showCancel: false }
			);
		}
	}

	/**
	 * 预览模式后退
	 */
	previewBack() {
		if (this.state.previewHistoryIndex > 0) {
			this.state.previewHistoryIndex--;
			const historyItem = this.state.previewHistory[this.state.previewHistoryIndex];
			this.state.previewContent = historyItem.content || '';
			this.updateDOM();
		}
	}

	/**
	 * 预览模式前进
	 */
	previewForward() {
		if (this.state.previewHistoryIndex < this.state.previewHistory.length - 1) {
			this.state.previewHistoryIndex++;
			const historyItem = this.state.previewHistory[this.state.previewHistoryIndex];
			this.state.previewContent = historyItem.content || '';
			this.updateDOM();
		}
	}

	/**
	 * 触发文件上传
	 */
	triggerFileUpload() {
		if (this.fileInputRef) {
			this.fileInputRef.click();
		}
	}

	/**
	 * 处理文件上传
	 * @param {FileList} files - 上传的文件列表
	 */
	async handleFileUpload(files) {
		if (!files || files.length === 0) return;

		for (const file of files) {
			await this.uploadFile(file);
		}
	}

	/**
	 * 上传单个文件
	 * @param {File} file - 文件对象
	 * @returns {Promise<void>}
	 */
	async uploadFile(file) {
		try {
			const fileName = file.name.toLowerCase();
			const extension = fileName.split('.').pop();

			// 验证文件类型
			const allowedExtensions = ['txt', 'md', 'jpg', 'jpeg', 'png', 'mp3'];
			if (!allowedExtensions.includes(extension)) {
				const modal = new window.Modal();
				modal.showInfo(
					this.t('editorPage.errors.error', '错误'),
					this.t('editorPage.errors.invalidFileType', '不支持的文件类型，仅支持 txt, md, jpg, png, mp3'),
					{ showCancel: false }
				);
				return;
			}

			// 获取当前仓库信息
			const currentRepo = window.app.setting.current_repo;

			const parsed = currentRepo.split('/');

			const [owner, repo] = parsed;

			// 处理文本文件(txt, md)
			if (extension === 'txt' || extension === 'md') {
				const text = await file.text();
				this.insertTextAtCursor(text);
				return;
			}

			// 处理媒体文件(jpg, png, mp3)
			if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') {
				await this.uploadImage(file, owner, repo);
			} else if (extension === 'mp3') {
				await this.uploadAudio(file, owner, repo);
			}
		} catch (error) {
			console.error('上传文件失败:', error);
		}
	}

	/**
	 * 上传图片
	 * @param {File} file - 图片文件
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名
	 * @returns {Promise<void>}
	 */
	async uploadImage(file, owner, repo) {
		// 检查是否已存在同名文件
		const imagePath = `${owner}/${repo}/images/${file.name}`;
		const existingMedia = await window.StorageService.execute('medias', 'get', imagePath).catch(() => null);

		if (existingMedia) {
			// 询问是否覆盖
			const confirmed = await this.confirmOverwrite(file.name);
			if (!confirmed) return;
		}

		// 处理图片：缩放为最大1600像素，保留比例和格式
		const imageBlob = await this.processImage(file);

		// 保存到本地
		await window.StorageService.saveMedia(imagePath, imageBlob);
		await window.StorageService.savePendingFile(imagePath);

		// 插入链接到编辑器
		const linkMarkdown = `![${file.name}](${imagePath})\n`;
		this.insertTextAtCursor(linkMarkdown);

		// 添加到待提交列表
		await window.StorageService.savePendingFile(imagePath);

	}

	/**
	 * 上传音频
	 * @param {File} file - 音频文件
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名
	 * @returns {Promise<void>}
	 */
	async uploadAudio(file, owner, repo) {
		// 检查音频长度（不能超过5分钟）
		const audioDuration = await this.getAudioDuration(file);
		if (audioDuration > 300) { // 5分钟 = 300秒
			const modal = new window.Modal();
			modal.showInfo(
				this.t('editorPage.errors.error', '错误'),
				this.t('editorPage.errors.audioTooLong', '音频文件不能超过5分钟'),
				{ showCancel: false }
			);
			return;
		}

		// 检查是否已存在同名文件
		const audioPath = `${owner}/${repo}/audios/${file.name}`;
		const existingMedia = await window.StorageService.execute('medias', 'get', audioPath).catch(() => null);

		if (existingMedia) {
			// 询问是否覆盖
			const confirmed = await this.confirmOverwrite(file.name);
			if (!confirmed) return;
		}

		// 保存到本地
		await window.StorageService.saveMedia(audioPath, file);
		await window.StorageService.savePendingFile(audioPath);

		// 插入链接到编辑器
		const linkMarkdown = `<audio controls src="${audioPath}"></audio>\n`;
		this.insertTextAtCursor(linkMarkdown);

		// 添加到待提交列表
		await window.StorageService.savePendingFile(audioPath);

	}

	/**
	 * 处理图片（缩放为最大1600像素）
	 * @param {File} file - 原始图片文件
	 * @returns {Promise<Blob>} 处理后的图片Blob
	 */
	async processImage(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					let width = img.width;
					let height = img.height;

					// 计算缩放比例
					const maxDimension = 1600;
					if (width > maxDimension || height > maxDimension) {
						if (width > height) {
							height = (height * maxDimension) / width;
							width = maxDimension;
						} else {
							width = (width * maxDimension) / height;
							height = maxDimension;
						}
					}

					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0, width, height);

					canvas.toBlob((blob) => {
						if (blob) {
							resolve(blob);
						} else {
							reject(new Error('图片处理失败'));
						}
					}, file.type, 0.9);
				};
				img.onerror = reject;
				img.src = e.target.result;
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	/**
	 * 获取音频时长
	 * @param {File} file - 音频文件
	 * @returns {Promise<number>} 音频时长（秒）
	 */
	async getAudioDuration(file) {
		return new Promise((resolve, reject) => {
			const audio = new Audio();
			audio.onloadedmetadata = () => {
				resolve(audio.duration);
			};
			audio.onerror = reject;
			audio.src = URL.createObjectURL(file);
		});
	}

	/**
	 * 确认覆盖媒体文件
	 * @param {string} fileName - 文件名
	 * @returns {Promise<boolean>} 是否确认覆盖
	 */
	async confirmOverwrite(fileName) {
		return new Promise((resolve) => {
			const modal = new window.Modal();
			modal.showConfirm(
				this.t('editorPage.confirmOverwrite', '确认覆盖'),
				this.t('editorPage.overwriteMessage', '文件已存在，是否覆盖？'),
				(confirmed) => {
					resolve(confirmed);
				}
			);
		});
	}

	/**
	 * 在光标位置插入文本
	 * @param {string} text - 要插入的文本
	 */
	insertTextAtCursor(text) {
		if (!this.editorRef) return;

		// 使用 CodeMirror API
		const cursor = this.editorRef.getCursor();
		const from = this.editorRef.getCursor('from');
		const to = this.editorRef.getCursor('to');

		// 替换选中的文本
		this.editorRef.replaceRange(text, from, to);

		// 更新状态
		this.state.content = this.editorRef.getValue();

		// 移动光标到插入位置
		const newPos = { line: cursor.line, ch: cursor.ch + text.length };
		this.editorRef.setCursor(newPos);
		this.editorRef.focus();
	}

	/**
	 * 删除文件
	 * @returns {Promise<void>}
	 */
	async deleteFile() {
		try {
			const filePath = this.state.filePath;
			if (!filePath) {
				return;
			}

			// 确认删除
			const confirmed = await this.confirmDelete();
			if (!confirmed) return;

			// 删除本地文件
			await window.StorageService.deleteFile(filePath);

			// 删除待提交文件，即便删了本地文件服务器端的也不会删除
			await window.StorageService.deletePendingFile(filePath);

			window.app.setting.current_article = '';
			window.app.setting.read_path.pop();
			window.app.setting.read_path_index = window.app.setting.read_path.length - 1;
			window.StorageService.saveKV('setting', window.app.setting);

			// 返回阅读页面
			await window.app.navigateTo('/view');
		} catch (error) {
			console.error('删除文件失败:', error);
			const modal = new window.Modal();
			modal.showInfo(
				this.t('editorPage.errors.error', '错误'),
				this.t('editorPage.errors.deleteFailed', '删除失败: ') + error.message,
				{ showCancel: false }
			);
		}
	}

	/**
	 * 确认删除
	 * @returns {Promise<boolean>} 是否确认删除
	 */
	async confirmDelete() {
		return new Promise((resolve) => {
			const modal = new window.Modal();
			modal.showConfirm(
				this.t('editorPage.confirmDelete', '确认删除'),
				this.t('editorPage.deleteMessage', '确定要删除当前文档吗？此操作不可撤销。并且不会删除已经提交到服务器端的文件。'),
				(confirmed) => {
					resolve(confirmed);
				}
			);
		});
	}


	/**
	 * 请求链接（向原作者发送链接申请）
	 * @returns {Promise<void>}
	 */
	async requestLink() {
		try {
			// 检查是否在pending表中
			const pathParsed = window.app.parsePath(this.state.filePath);
			const currentRepo = pathParsed.repo;
			const pendingFiles = await window.StorageService.getPendingFiles(currentRepo);
			const isPending = pendingFiles.some(pf => pf.path === this.state.filePath);

			if (isPending) {
				// 文件未提交，显示提示模态框
				const modal = new window.Modal();
				modal.showInfo(
					this.t('common.info', '提示'),
					this.t('editorPage.submitFirstMessage', '请先提交文件后再申请链接'),
					{ showCancel: false }
				);
				return;
			}

			// 2. 获取当前作品的所有文件
			const allFiles = await window.StorageService.execute('files', 'getAll');
			const currentUser = window.app.user.username || window.app.user.name;
			const currentRepoFull = `${pathParsed.owner}/${currentRepo}`;

			// 3. 过滤出当前作品的其他作者的文件（还没有建立链接的）
			// 获取所有已建立的链接
			const allLinks = await window.StorageService.execute('links', 'getAll');
			const existingLinks = new Set();
			allLinks.forEach(link => {
				if (link.localPath === this.state.filePath) {
					existingLinks.add(link.remotePath);
				}
			});

			// 过滤条件：
			// - 同一作品
			// - 不是当前文章
			// - 不是当前作者
			// - 还没有建立链接
			// - 不是CONTRIBUTING.md,LICENSE.md,DIPCP.md
			const otherAuthorFiles = allFiles.filter(file => {
				const fileParsed = window.app.parsePath(file.path);
				if (!fileParsed) return false;

				// 不是当前文章
				const isNotCurrentFile = file.path !== this.state.filePath;

				// 同一作品
				const fileRepo = `${fileParsed.owner}/${fileParsed.repo}`;
				const isSameRepo = fileRepo === currentRepoFull || fileParsed.repo === currentRepo;

				// 不是当前作者
				const isOtherAuthor = fileParsed.owner !== currentUser;

				// 还没有建立链接
				const notLinked = !existingLinks.has(file.path);

				// 不是CONTRIBUTING.md, LICENSE.md, DIPCP.md
				const fileName = fileParsed.fullFilename || fileParsed.filename || '';
				const isNotSystemFile = !['CONTRIBUTING.md', 'LICENSE.md', 'DIPCP.md'].includes(fileName);
				return isNotCurrentFile && isSameRepo && isOtherAuthor && notLinked && isNotSystemFile;
			});

			if (otherAuthorFiles.length === 0) {
				const modal = new window.Modal();
				modal.showInfo(
					this.t('common.info', '提示'),
					this.t('editorPage.noFilesMessage', '当前作品中没有其他作者未建立链接的文章'),
					{ showCancel: false }
				);
				return;
			}

			// 4. 显示下拉列表模态框
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
				const currentFileNameWithoutExt = window.app.parsePath(this.state.filePath).filename;
				const matchCount = this.countWordMatches(plainText, currentFileNameWithoutExt);

				// 更新显示区域
				const contentContainer = modal.element?.querySelector('#modal-select-content');
				if (contentContainer) {
					contentContainer.innerHTML = `
						<div style="margin-bottom: 8px;">
							<strong>${this.t('editorPage.contentPreview', '内容预览')}:</strong>
							<span style="color: var(--text-secondary); font-size: 0.9em; margin-left: 8px;">
								${this.t('editorPage.matchedWords', '匹配到')} <strong>${matchCount}</strong> ${this.t('editorPage.sameNameWords', '个同名词语')}
							</span>
						</div>
						<div style="max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word; line-height: 1.5;">
							${this.escapeHtml(plainText.substring(0, 1000))}${plainText.length > 1000 ? '...' : ''}
						</div>
					`;
				}
			};

			modal.showSelect(
				this.t('editorPage.selectLinkFile', '选择要链接的文章'),
				this.t('editorPage.selectLinkFileLabel', '请选择当前作品中其他作者的文章：'),
				options,
				onSelectChange,
				async (selectedPath) => {
					// 确认后发送申请
					if (!selectedPath || !selectedFileData) return;

					try {
						const selectedParsed = window.app.parsePath(selectedPath);
						const targetOwner = selectedParsed.owner;
						const targetRepo = selectedParsed.repo;

						// 先检查仓库信息，确认 Issues 是否启用
						const repoInfo = await window.GitHubService.getRepo(targetOwner, targetRepo);

						// 如果仓库存在且 Issues 未启用，提供提示
						if (repoInfo && !repoInfo.has_issues) {
							const errorModal = new window.Modal();
							const errorMsg = this.t('editorPage.issuesDisabledError', '目标仓库的 Issues 功能未启用。请联系仓库所有者启用 Issues 功能。') + `\n\n仓库: ${targetOwner}/${targetRepo}`;
							errorModal.showInfo(
								this.t('common.error', '错误'),
								errorMsg,
								{ showCancel: false }
							);
							return;
						}

						// 创建Issue（使用英文标题和内容，不使用 label）
						// 将 request file 路径中的 owner 替换为当前用户（因为文件应该保存在当前用户的仓库中）
						const requestFilePath = this.state.filePath;
						const requestPathParsed = window.app.parsePath(requestFilePath);
						const requestFileForIssue = requestPathParsed
							? `${currentUser}/${requestPathParsed.repo}${requestPathParsed.dirPath ? '/' + requestPathParsed.dirPath : ''}/${requestPathParsed.fullFilename}`
							: requestFilePath; // 如果解析失败，保持原路径

						const issueTitle = `Link Request: ${this.state.fileName}`;
						const issueBody = `**applicant**: ${currentUser}\n` +
							`**request file**: ${requestFileForIssue}\n` +
							`**link to file**: ${selectedPath}`;

						// 不使用 label，直接创建 Issue
						const createdIssue = await window.GitHubService.createIssue(targetOwner, targetRepo, {
							title: issueTitle,
							body: issueBody
						});

						// 保存到links表
						const linkData = {
							repo: currentRepo,
							localPath: this.state.filePath,
							remotePath: selectedPath,
							state: 1 // 1-申请中
						};
						await window.StorageService.execute('links', 'add', linkData);

					} catch (error) {
						// 获取错误状态码（支持多种错误格式）
						const statusCode = error.status || error.response?.status || error.response?.statusCode;

						// 根据错误类型提供更友好的错误提示
						let errorMessage = error.message || this.t('editorPage.linkRequestFailed', '发送链接申请失败');

						// 处理 403 权限错误
						if (statusCode === 403 || error.message.includes('权限') || error.message.includes('权限不足')) {
							errorMessage = this.t('editorPage.linkRequestPermissionError', '无法创建链接申请：权限不足。请确保目标仓库已启用 Issues 功能，且您有访问权限。');
						}
						// 处理 404 错误
						else if (statusCode === 404 || error.message.includes('不存在') || error.message.includes('无法访问')) {
							errorMessage = this.t('editorPage.linkRequestNotFoundError', '无法创建链接申请：目标仓库不存在或无法访问。');
						}
						// 其他错误
						else if (error.message) {
							errorMessage = this.t('editorPage.linkRequestFailed', '发送链接申请失败: ') + error.message;
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
				this.t('editorPage.linkRequestFailed', '发送链接申请失败: ') + error.message,
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

		// 转义正则表达式特殊字符（与 678-700 行的逻辑一致）
		const escapedName = this.escapeRegex(word);

		// 直接匹配，不使用单词边界（与 678-700 行的逻辑一致）
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
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * 恢复光标位置
	 */
	restoreCursorPosition() {
		if (this.editorRef && window.app.setting.cursor_position && this.editorRef.setCursor) {
			const position = window.app.setting.cursor_position;
			// CodeMirror 使用 {line, ch} 格式，需要将字符位置转换为行列
			const content = this.editorRef.getValue();
			const lines = content.substring(0, position).split('\n');
			const line = lines.length - 1;
			const ch = lines[line].length;
			this.editorRef.setCursor({ line, ch });
			this.editorRef.focus();
		}
	}

	/**
	 * 保存光标位置
	 */
	saveCursorPosition() {
		if (this.editorRef && this.editorRef.getCursor) {
			const cursor = this.editorRef.getCursor();
			// 将行列位置转换为字符位置
			const content = this.editorRef.getValue();
			const lines = content.split('\n');
			let position = 0;
			for (let i = 0; i < cursor.line && i < lines.length; i++) {
				position += lines[i].length + 1; // +1 for newline
			}
			position += cursor.ch;
			window.app.setting.cursor_position = position;
			window.StorageService.saveKV('setting', window.app.setting);
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

		// 更新标题区
		const titleArea = this.element.querySelector('.editor-title-area');
		if (titleArea) {
			titleArea.outerHTML = this.renderTitleArea();
		}

		// 更新主内容区
		const contentArea = this.element.querySelector('.editor-content');
		if (contentArea) {
			const mainContent = contentArea.querySelector('.editor-panel, .editor-preview');
			if (mainContent) {
				mainContent.outerHTML = this.renderMainContent();
			} else {
				// 如果找不到主内容区，直接替换整个内容
				contentArea.innerHTML = `
					${this.renderTitleArea()}
					${this.renderMainContent()}
				`;
			}
		}

		// 重新绑定事件（必须在更新DOM之后）
		this.bindEvents();

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}

		// 更新固定定位的top值
		this.updateStickyPositions();

		// 恢复编辑器引用（CodeMirror 实例在 bindEvents 中初始化）

		// 确保留言框的值与 state 同步
		const messageTextarea = this.element.querySelector('#editor-message-textarea');
		if (messageTextarea) {
			this.authorMessageRef = messageTextarea;
			if (messageTextarea.value !== this.state.authorMessage) {
				messageTextarea.value = this.state.authorMessage || '';
			}
		}

		// 如果是预览模式，加载媒体文件
		if (this.state.isPreview) {
			// 延迟加载，确保DOM已更新
			setTimeout(() => {
				this.loadMediaElements();
			}, 100);
		}

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
	 * 转义正则表达式特殊字符
	 * @param {string} string - 要转义的字符串
	 * @returns {string} 转义后的字符串
	 */
	escapeRegex(string) {
		if (typeof string !== 'string') {
			return '';
		}
		// 转义正则表达式特殊字符
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}


	/**
	 * 注销组件
	 */
	destroy() {
		// 清除自动保存定时器
		if (this.state.autoSaveTimer) {
			clearInterval(this.state.autoSaveTimer);
			this.state.autoSaveTimer = null;
		}

		// 离开前如果有未保存的更改，自动保存（和自动保存一样，不做链接转化）
		if (this.state.hasUnsavedChanges) {
			this.autoSave().catch(() => { });
		}

		// 保存光标位置
		this.saveCursorPosition();

		// 移除文件上传input
		if (this.fileInputRef && this.fileInputRef.parentNode) {
			this.fileInputRef.parentNode.removeChild(this.fileInputRef);
			this.fileInputRef = null;
		}

		// 调用父类销毁方法
		super.destroy();
	}
}

// 注册组件
window.EditorPage = EditorPage;