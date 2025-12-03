/**
 * 通知页面组件
 * 显示链接申请列表和反馈列表
 * @class NoticesPage
 * @extends {BasePage}
 */
class NoticesPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.state = {
			loading: true,
			activeTab: 'requests', // 'requests' 或 'feedback'
			requests: [], // 收到的申请列表
			feedback: [], // 收到的反馈列表
			selectedRequest: null, // 选中的申请详情
			selectedFeedback: null, // 选中的反馈详情
			requestPreviewLoading: false,
			requestPreviewHtml: '',
			requestPreviewError: '',
			requestPreviewData: null,
			requestPreviewHistory: [],
			requestPreviewHistoryIndex: -1,
			rejectReason: ''
		};
	}

	/**
	 * 渲染页面
	 * @returns {HTMLElement} 渲染后的DOM元素
	 */
	render() {
		const container = document.createElement('div');
		container.className = 'dashboard';

		container.innerHTML = `
			${this.renderHeader()}
			<main class="project-detail-main">
				<div class="notices-content">
					${this.renderTabs()}
					${this.renderContent()}
				</div>
			</main>
		`;
		return container;
	}


	/**
	 * 渲染标签页
	 * @returns {string} 标签页HTML字符串
	 */
	renderTabs() {
		const requestsActive = this.state.activeTab === 'requests' ? 'active' : '';
		const feedbackActive = this.state.activeTab === 'feedback' ? 'active' : '';

		return `
			<div class="tabs">
				<button class="tab-button ${requestsActive}" data-tab="requests">
					<span class="tab-icon">📋</span>
				</button>
				<button class="tab-button ${feedbackActive}" data-tab="feedback">
					<span class="tab-icon">💬</span>
				</button>
			</div>
		`;
	}

	/**
	 * 渲染内容区
	 * @returns {string} 内容区HTML字符串
	 */
	renderContent() {
		if (this.state.loading) {
			return `<div class="loading">${this.t('common.loading', '载入中...')}</div>`;
		}

		if (this.state.activeTab === 'requests') {
			if (this.state.selectedRequest) {
				return this.renderRequestDetail();
			}
			return this.renderRequestsList();
		} else {
			if (this.state.selectedFeedback) {
				return this.renderFeedbackDetail();
			}
			return this.renderFeedbackList();
		}
	}

	/**
	 * 渲染申请列表
	 * @returns {string} 申请列表HTML字符串
	 */
	renderRequestsList() {
		if (this.state.requests.length === 0) {
			return `
				<div class="repository-history-header">
                    <h3>${this.t('noticesPage.noRequests', '暂无申请')}</h3>
                    <button class="refresh-btn" id="refresh-projects-btn" data-action="refresh" title="${this.t('noticesPage.refresh', '刷新')}">
                        <span class="refresh-icon">🔄</span>
                    </button>
				</div>
			`;
		}

		const requestsHtml = this.state.requests.map((request, index) => {
			const date = new Date(request.created_at).toLocaleString(window.app?.setting?.language);
			const title = this.getLocalizedRequestTitle(request.title || '');
			return `
				<div class="notice-item" data-index="${index}">
					<div class="notice-item-header">
						<div class="notice-item-title">${this.escapeHtml(title)}</div>
						<div class="notice-item-date">${date}</div>
					</div>
					<div class="notice-item-body">
						${this.escapeHtml(this.extractIssuePreview(request.body || ''))}
					</div>
				</div>
			`;
		}).join('');

		return `<div class="notices-list">${requestsHtml}</div>`;
	}

	/**
	 * 渲染申请详情
	 * @returns {string} 申请详情HTML字符串
	 */
	renderRequestDetail() {
		const request = this.state.selectedRequest;
		if (!request) return '';

		const date = new Date(request.created_at).toLocaleString(window.app?.setting?.language);
		const parsed = this.parseIssueBody(request.body || '');
		const localizedTitle = this.getLocalizedRequestTitle(request.title || '');
		const canPreviewGoBack = this.state.requestPreviewHistoryIndex > 0;
		const canPreviewGoForward = this.state.requestPreviewHistoryIndex >= 0
			&& this.state.requestPreviewHistoryIndex < this.state.requestPreviewHistory.length - 1;

		return `
			<div class="notice-detail">
				<div class="notice-detail-header">
					<h3>${this.escapeHtml(localizedTitle)}</h3>
					<div class="notice-detail-date">${date}</div>
				</div>
				<div class="notice-detail-body">
					<div class="notice-detail-section">
						<div class="notice-preview-header">
							<div class="notice-detail-label">${this.t('noticesPage.preview', '预览')}</div>
							<div class="notice-preview-nav">
								<button class="toolbar-btn preview-nav-btn" data-action="preview-history-back" ${!canPreviewGoBack ? 'disabled' : ''} title="${this.t('noticesPage.previewBack', '返回上一页')}">
									◀
								</button>
								<button class="toolbar-btn preview-nav-btn" data-action="preview-history-forward" ${!canPreviewGoForward ? 'disabled' : ''} title="${this.t('noticesPage.previewForward', '前进')}">
									▶
								</button>
							</div>
						</div>
						${this.renderRequestPreviewContent()}
					</div>
				</div>
				<div class="notice-detail-actions">
					<button class="btn btn-primary" data-action="accept-request">${this.t('noticesPage.accept', '接受')}</button>
					<button class="btn btn-secondary" data-action="reject-request">${this.t('noticesPage.reject', '拒绝')}</button>
				</div>
			</div>
		`;
	}

	renderRequestPreviewContent() {
		if (this.state.requestPreviewLoading) {
			return `<div class="notice-preview notice-preview-loading">${this.t('noticesPage.loadingPreview', '正在加载预览...')}</div>`;
		}

		if (this.state.requestPreviewError) {
			return `<div class="notice-preview notice-preview-error">${this.escapeHtml(this.state.requestPreviewError)}</div>`;
		}

		if (this.state.requestPreviewHtml) {
			return `<div class="notice-preview notice-preview-content">${this.state.requestPreviewHtml}</div>`;
		}

		return `<div class="notice-preview notice-preview-empty">${this.t('noticesPage.previewEmpty', '暂无内容')}</div>`;
	}

	/**
	 * 解析反馈消息
	 * @param {string} body - 反馈消息内容
	 * @returns {Object} 解析结果 { accepted, link, reason }
	 */
	parseFeedbackBody(body) {
		const result = {
			accepted: false,
			link: '',
			reason: ''
		};

		if (!body) return result;

		// 检查是否接受
		if (body.includes('✅ **Accepted**')) {
			result.accepted = true;
			// 提取链接：✅ **Accepted**: link
			const acceptedMatch = body.match(/\*\*Accepted\*\*:\s*([^\n]+)/);
			if (acceptedMatch) {
				result.link = acceptedMatch[1].trim();
			}
		} else if (body.includes('❌ **Rejected**')) {
			result.accepted = false;
			// 提取链接：❌ **Rejected**: link
			const rejectedMatch = body.match(/\*\*Rejected\*\*:\s*([^\n]+)/);
			if (rejectedMatch) {
				result.link = rejectedMatch[1].trim();
			}
			// 提取理由：**Reason**: reason
			const reasonMatch = body.match(/\*\*Reason\*\*:\s*([^\n]+)/);
			if (reasonMatch) {
				result.reason = reasonMatch[1].trim();
			}
		}

		return result;
	}

	/**
	 * 渲染反馈列表
	 * @returns {string} 反馈列表HTML字符串
	 */
	renderFeedbackList() {
		if (this.state.feedback.length === 0) {
			return `
                <div class="repository-history-header">
                    <h3>${this.t('noticesPage.noFeedback', '暂无反馈')}</h3>
                    <button class="refresh-btn" id="refresh-feedback-btn" data-action="refresh" title="${this.t('noticesPage.refresh', '刷新')}">
                        <span class="refresh-icon">🔄</span>
                    </button>
                </div>
			`;
		}

		const feedbackHtml = this.state.feedback.map((item, index) => {
			const date = new Date(item.updated_at || item.created_at).toLocaleString(window.app?.setting?.language);
			const parsed = this.parseFeedbackBody(item.body || '');
			const linkParsed = window.app.parsePath(parsed.link);
			const linkDisplay = linkParsed ? linkParsed.filename : parsed.link;
			const statusText = parsed.accepted
				? `✅ ${this.t('noticesPage.accepted', '已接受')}`
				: `❌ ${this.t('noticesPage.rejected', '已拒绝')}`;

			return `
				<div class="notice-item" data-index="${index}">
					<div class="notice-item-header">
						<div class="notice-item-title">${this.escapeHtml(statusText)}</div>
						<div class="notice-item-date">${date}</div>
					</div>
					<div class="notice-item-body">
						<div class="notice-item-link">${this.t('noticesPage.link', '链接')}: ${this.escapeHtml(linkDisplay)}</div>
						${parsed.reason ? `<div class="notice-item-reason">${this.t('noticesPage.reason', '理由')}: ${this.escapeHtml(parsed.reason)}</div>` : ''}
					</div>
				</div>
			`;
		}).join('');

		return `<div class="notices-list">${feedbackHtml}</div>`;
	}

	/**
	 * 渲染反馈详情
	 * @returns {string} 反馈详情HTML字符串
	 */
	renderFeedbackDetail() {
		const feedback = this.state.selectedFeedback;
		if (!feedback) return '';

		const date = new Date(feedback.updated_at || feedback.created_at).toLocaleString(window.app?.setting?.language);
		const parsed = this.parseFeedbackBody(feedback.body || '');
		const statusText = parsed.accepted
			? `✅ ${this.t('noticesPage.accepted', '已接受')}`
			: `❌ ${this.t('noticesPage.rejected', '已拒绝')}`;

		return `
			<div class="notice-detail">
				<div class="notice-detail-header">
					<h3>${this.escapeHtml(statusText)}</h3>
					<div class="notice-detail-date">${date}</div>
				</div>
				<div class="notice-detail-body">
					<div class="notice-detail-section">
						<div class="notice-detail-label">${this.t('noticesPage.link', '链接')}</div>
						<div class="notice-detail-value">${this.escapeHtml(parsed.link)}</div>
					</div>
					${parsed.reason ? `
						<div class="notice-detail-section">
							<div class="notice-detail-label">${this.t('noticesPage.reason', '理由')}</div>
							<div class="notice-detail-value">${this.escapeHtml(parsed.reason)}</div>
						</div>
					` : ''}
				</div>
				<div class="notice-detail-actions">
					<button class="btn btn-primary" data-action="close-feedback">${this.t('noticesPage.close', '关闭')}</button>
				</div>
			</div>
		`;
	}

	/**
	 * 挂载组件到容器
	 * @param {HTMLElement} container - 容器元素
	 * @param {any} path - 路径参数（可选）
	 */
	async mount(container, path = null) {
		super.mount(container, path);

		// 加载数据
		await this.loadData();

		// 绑定事件
		this.bindEvents();
	}

	/**
	 * 加载数据
	 * @returns {Promise<void>}
	 */
	async loadData() {
		try {
			this.state.loading = true;
			this.updateDOM();
			await window.app._checkUnreadIssues();

			// 加载申请列表
			await this.loadRequests();

			// 加载反馈列表
			await this.loadFeedback();

			// 根据数据情况自动切换标签页
			if (this.state.requests.length > 0) {
				// 如果有申请数据，优先显示申请列表
				this.state.activeTab = 'requests';
			} else if (this.state.feedback.length > 0) {
				// 如果没有申请但有反馈，显示反馈列表
				this.state.activeTab = 'feedback';
			}
			// 如果都没有数据，保持当前标签页

			this.state.loading = false;
			this.updateDOM();
		} catch (error) {
			console.error('加载通知数据失败:', error);
			this.state.loading = false;
			this.updateDOM();
		}
	}

	/**
	 * 加载 Issues
	 * @param {string} title - 标题
	 * @returns {Promise<void>}
	 */
	async loadIssues(title) {
		try {
			const requests = [];
			// 通过标题识别 Issues
			for (const issue of window.app.issues) {
				if (issue.title && issue.title.startsWith(title)) {
					requests.push(issue);
				}
			}

			return requests;
		} catch (error) {
			console.error('❌ [loadIssues] 加载 Issues 失败:', error);
			return [];
		}
	}

	/**
	 * 加载申请列表
	 * @returns {Promise<void>}
	 */
	async loadRequests() {
		this.state.requests = await this.loadIssues('Link Request:');
	}

	/**
	 * 加载反馈列表
	 * @returns {Promise<void>}
	 */
	async loadFeedback() {
		this.state.feedback = await this.loadIssues('Application result:');
	}

	/**
	 * 解析 Issue 内容
	 * @param {string} body - Issue 内容
	 * @returns {Object} 解析结果
	 */
	parseIssueBody(body) {
		const result = {
			applicant: '',
			requestFile: '',
			linkToFile: ''
		};

		// 解析申请者（支持中英文格式）
		const applicantMatch = body.match(/\*\*applicant\*\*:\s*([^\n]+)/i) ||
			body.match(/\*\*申请者\*\*:\s*([^\n]+)/);
		if (applicantMatch) {
			result.applicant = applicantMatch[1].trim();
		}

		// 解析申请的文件（支持中英文格式）
		const requestFileMatch = body.match(/\*\*request file\*\*:\s*([^\n]+)/i) ||
			body.match(/\*\*申请的文件\*\*:\s*([^\n]+)/);
		if (requestFileMatch) {
			result.requestFile = requestFileMatch[1].trim();
		}

		// 解析链接到的文件（支持中英文格式）
		const linkToFileMatch = body.match(/\*\*link to file\*\*:\s*([^\n]+)/i) ||
			body.match(/\*\*链接到的文件\*\*:\s*([^\n]+)/);
		if (linkToFileMatch) {
			result.linkToFile = linkToFileMatch[1].trim();
		}

		return result;
	}

	/**
	 * 提取 Issue 预览文本
	 * @param {string} body - Issue 内容
	 * @returns {string} 预览文本
	 */
	extractIssuePreview(body) {
		if (!body) return '';

		// 解析 issue body
		const parsed = this.parseIssueBody(body);

		// 使用 i18n 格式化显示
		const parts = [];
		if (parsed.applicant) {
			parts.push(`${this.t('noticesPage.applicant', '申请者')}: ${parsed.applicant}`);
		}
		if (parsed.requestFile) {
			// 只显示文件名，不显示完整路径
			const requestFileParsed = window.app?.parsePath?.(parsed.requestFile);
			const requestFileName = requestFileParsed?.filename || parsed.requestFile.split('/').pop() || parsed.requestFile;
			parts.push(`${this.t('noticesPage.requestFile', '申请的文件')}: ${requestFileName}`);
		}
		if (parsed.linkToFile) {
			// 只显示文件名，不显示完整路径
			const linkToFileParsed = window.app?.parsePath?.(parsed.linkToFile);
			const linkToFileName = linkToFileParsed?.filename || parsed.linkToFile.split('/').pop() || parsed.linkToFile;
			parts.push(`${this.t('noticesPage.linkToFile', '链接到的文件')}: ${linkToFileName}`);
		}

		return parts.length > 0 ? parts.join(' | ') : body.substring(0, 100) + (body.length > 100 ? '...' : '');
	}

	/**
	 * 选择请求
	 * @param {number} index - 索引
	 * @returns {Promise<void>}
	 */
	async selectRequest(index) {
		if (this.state.activeTab === 'requests') {
			this.resetRequestPreviewState();
			this.state.selectedRequest = this.state.requests[index];
			this.state.selectedFeedback = null;
			this.state.requestPreviewLoading = true;
			this.updateDOM();
			await this.prepareRequestPreview(this.state.selectedRequest);
		} else {
			this.state.selectedFeedback = this.state.feedback[index];
			this.state.selectedRequest = null;
			this.resetRequestPreviewState();
			this.updateDOM();
		}
	}

	/**
	 * 准备请求预览
	 * @param {Object} request - 请求对象
	 * @param {Object} options - 选项
	 * @param {boolean} options.silent - 是否静默模式
	 * @returns {Promise<void>}
	 */
	async prepareRequestPreview(request, options = {}) {
		if (!request) return;
		const { silent = false } = options;

		if (!silent) {
			this.state.requestPreviewLoading = true;
			this.state.requestPreviewError = '';
			this.state.requestPreviewHtml = '';
			this.updateDOM();
		}

		try {
			const parsed = this.parseIssueBody(request.body || '');
			if (!parsed.linkToFile || !parsed.requestFile) {
				throw new Error(this.t('noticesPage.previewMissingPaths', '申请信息缺失，无法生成预览。'));
			}

			// request file 已经是正确的路径（当前用户的仓库路径），直接使用
			const requestFile = parsed.requestFile;
			const linkToFile = parsed.linkToFile;

			const { fileData, normalizedPath: normalizedLinkToPath } = await this.loadFileContent(linkToFile);
			if (!fileData || !fileData.content) {
				throw new Error(this.t('noticesPage.previewMissingFile', '无法加载本地文件，请先同步该作品。'));
			}

			const parsedFile = window.app.parseArticleContent(fileData.content);
			let content = parsedFile.content || '';
			let authorMessage = '';
			const separatorIndex = content.indexOf('-*-*-');
			if (separatorIndex !== -1) {
				authorMessage = content.substring(separatorIndex + 5).trim();
				content = content.substring(0, separatorIndex).trim();
			}

			// 解析 request file 路径，获取文件名
			const requestParsed = window.app.parsePath(requestFile);
			const linkLabel = requestParsed?.filename || requestFile.split('/').pop() || requestFile;
			// 使用 request file 的完整路径作为链接
			const linkMarkdown = `[${linkLabel}](${requestFile})`;

			// 检查链接是否已存在
			if (content.includes(linkMarkdown)) {
				throw new Error(this.t('noticesPage.errors.linkExists', '链接已存在'));
			}

			let updatedBody = content;
			let replaced = false;
			if (requestParsed?.filename) {
				const replaceResult = this.replaceWordOutsideLinks(updatedBody, requestParsed.filename, linkMarkdown);
				updatedBody = replaceResult.text;
				replaced = replaceResult.replaced;
			}

			if (!replaced) {
				updatedBody = updatedBody.trim()
					? `${updatedBody.trim()}\n\n${linkMarkdown}`
					: linkMarkdown;
			}

			const previewHtml = this._renderArticleContent(updatedBody);

			// 解析并下载媒体文件（图片和音频）
			const mediaLinks = window.StorageService.parseMediaLinks(updatedBody);
			window.StorageService.downloadMediaFiles(mediaLinks);

			this.state.requestPreviewHtml = previewHtml;
			this.state.requestPreviewError = '';
			this.state.requestPreviewData = {
				issueNumber: request.number,
				linkToFile: normalizedLinkToPath,
				requestFile: requestFile,
				updatedBody,
				headerLines: parsedFile.header ? parsedFile.header.split('\n') : [],
				version: parsedFile.version,
				createTime: parsedFile.createTime,
				authorMessage
			};
			if (!silent) {
				this.state.requestPreviewHistory = [{
					path: normalizedLinkToPath,
					html: previewHtml
				}];
				this.state.requestPreviewHistoryIndex = 0;
			}
		} catch (error) {
			this.state.requestPreviewHtml = '';
			this.state.requestPreviewError = error.message || this.t('noticesPage.previewError', '加载预览失败');
			this.state.requestPreviewData = null;
			if (!silent) {
				this.state.requestPreviewHistory = [];
				this.state.requestPreviewHistoryIndex = -1;
			}
		} finally {
			this.state.requestPreviewLoading = false;
			if (!silent) {
				this.updateDOM();
			}
		}
	}

	/**
	 * 确保请求预览数据
	 * @param {Object} request - 请求对象
	 * @returns {Promise<Object>} 请求预览数据
	 */
	async ensureRequestPreviewData(request) {
		if (!request) return null;
		if (!this.state.requestPreviewData || this.state.requestPreviewData.issueNumber !== request.number) {
			await this.prepareRequestPreview(request, { silent: true });
		}
		return this.state.requestPreviewData;
	}

	/**
	 * 加载预览文章
	 * @param {string} path - 文件路径
	 * @returns {Promise<void>}
	 */
	async loadPreviewArticle(path) {
		if (!path) return;
		const decodedPath = decodeURIComponent(path);

		try {
			this.state.requestPreviewLoading = true;
			this.state.requestPreviewError = '';
			this.updateDOM();

			const currentEntry = this.state.requestPreviewHistory[this.state.requestPreviewHistoryIndex];
			const basePath = currentEntry?.path || this.state.requestPreviewData?.linkToFile || '';
			const { fileData, normalizedPath } = await this.loadFileContent(decodedPath, basePath);
			if (!fileData || !fileData.content) {
				throw new Error(this.t('noticesPage.previewMissingFile', '无法加载本地文件，请先同步该作品。'));
			}

			const parsed = window.app.parseArticleContent(fileData.content);
			const html = this._renderArticleContent(parsed.content || '');

			// 解析并下载媒体文件（图片和音频）
			const mediaLinks = window.StorageService.parseMediaLinks(parsed.content || '');
			window.StorageService.downloadMediaFiles(mediaLinks);

			this.state.requestPreviewHtml = html;
			this.state.requestPreviewError = '';

			// 更新历史
			if (this.state.requestPreviewHistoryIndex < this.state.requestPreviewHistory.length - 1) {
				this.state.requestPreviewHistory = this.state.requestPreviewHistory.slice(0, this.state.requestPreviewHistoryIndex + 1);
			}
			this.state.requestPreviewHistory.push({
				path: normalizedPath,
				html
			});
			this.state.requestPreviewHistoryIndex = this.state.requestPreviewHistory.length - 1;
		} catch (error) {
			this.state.requestPreviewHtml = '';
			this.state.requestPreviewError = error.message || this.t('noticesPage.previewError', '加载预览失败');
		} finally {
			this.state.requestPreviewLoading = false;
			this.updateDOM();
		}
	}

	/**
	 * 预览历史后退
	 * @returns {void}
	 */
	previewHistoryBack() {
		if (this.state.requestPreviewHistoryIndex <= 0) return;
		this.state.requestPreviewHistoryIndex -= 1;
		const entry = this.state.requestPreviewHistory[this.state.requestPreviewHistoryIndex];
		if (entry) {
			this.state.requestPreviewHtml = entry.html || '';
			this.state.requestPreviewError = '';
			this.state.requestPreviewLoading = false;
			this.updateDOM();
		}
	}

	/**
	 * 预览历史前进
	 * @returns {void}
	 */
	previewHistoryForward() {
		if (this.state.requestPreviewHistoryIndex >= this.state.requestPreviewHistory.length - 1) return;
		this.state.requestPreviewHistoryIndex += 1;
		const entry = this.state.requestPreviewHistory[this.state.requestPreviewHistoryIndex];
		if (entry) {
			this.state.requestPreviewHtml = entry.html || '';
			this.state.requestPreviewError = '';
			this.state.requestPreviewLoading = false;
			this.updateDOM();
		}
	}

	/**
	 * 替换单词，但只在外部链接范围内
	 * @param {string} text - 文本
	 * @param {string} word - 单词
	 * @param {string} replacement - 替换内容
	 * @returns {Object} 替换结果
	 */
	replaceWordOutsideLinks(text, word, replacement) {
		if (!word) {
			return { text, replaced: false };
		}

		const linkRanges = this.findMarkdownLinkRanges(text);
		const regex = new RegExp(this.escapeRegex(word), 'g');
		const matches = [];
		let match;

		while ((match = regex.exec(text)) !== null) {
			const start = match.index;
			const end = start + match[0].length;
			if (!this.isPositionInRanges(start, end, linkRanges)) {
				matches.push({ start, end });
			}
		}

		if (matches.length === 0) {
			return { text, replaced: false };
		}

		for (let i = matches.length - 1; i >= 0; i--) {
			const { start, end } = matches[i];
			text = text.substring(0, start) + replacement + text.substring(end);
		}

		return { text, replaced: true };
	}

	/**
	 * 查找 Markdown 链接范围
	 * @param {string} text - 文本
	 * @returns {Array} 范围数组
	 */
	findMarkdownLinkRanges(text) {
		const ranges = [];
		const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
		let match;

		while ((match = linkRegex.exec(text)) !== null) {
			ranges.push({
				start: match.index,
				end: match.index + match[0].length
			});
		}

		return ranges;
	}

	/**
	 * 判断位置是否在范围内
	 * @param {number} start - 开始位置
	 * @param {number} end - 结束位置
	 * @param {Array} ranges - 范围数组
	 * @returns {boolean} 是否在范围内
	 */
	isPositionInRanges(start, end, ranges) {
		return ranges.some(range => start >= range.start && end <= range.end);
	}

	/**
	 * 构建完整的文件内容
	 * @param {Object} previewData - 预览数据
	 * @returns {string} 完整的文件内容
	 */
	buildFullContentFromPreview(previewData) {
		const now = new Date().toISOString();
		let headerLines = previewData.headerLines;

		const currentVersion = parseInt(headerLines[1].replace('version:', '').trim());
		const nextVersion = currentVersion + 1;
		headerLines[1] = `version:${nextVersion}`;
		headerLines[2] = `update_time:${now}`;

		const header = headerLines.join('\n');
		let fullContent = `${header}\n${previewData.updatedBody.trim()}`;
		if (previewData.authorMessage) {
			fullContent += `\n-*-*-\n${previewData.authorMessage}`;
		}
		return fullContent;
	}

	/**
	 * 重置请求预览状态
	 */
	resetRequestPreviewState() {
		this.state.requestPreviewHtml = '';
		this.state.requestPreviewError = '';
		this.state.requestPreviewLoading = false;
		this.state.requestPreviewData = null;
		this.state.requestPreviewHistory = [];
		this.state.requestPreviewHistoryIndex = -1;
		this.state.rejectReason = '';
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		if (!this.element) return;

		// 刷新按钮事件（包括空状态中的刷新按钮）
		const refreshBtns = this.element.querySelectorAll('[data-action="refresh"]');
		refreshBtns.forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const action = e.currentTarget.dataset.action;
				this.handleToolbarAction(action);
			});
		});

		// 标签页切换事件
		const tabButtons = this.element.querySelectorAll('.tab-button');
		tabButtons.forEach(btn => {
			btn.addEventListener('click', (e) => {
				const tab = e.currentTarget.dataset.tab;
				this.state.activeTab = tab;
				this.state.selectedRequest = null;
				this.state.selectedFeedback = null;
				this.updateDOM();
			});
		});

		// 申请列表项点击事件
		const requestItems = this.element.querySelectorAll('.notices-list .notice-item');
		requestItems.forEach(item => {
			item.addEventListener('click', async (e) => {
				const index = parseInt(e.currentTarget.dataset.index);
				await this.selectRequest(index);
			});
		});

		// 接受申请按钮
		const acceptBtn = this.element.querySelector('[data-action="accept-request"]');
		if (acceptBtn) {
			acceptBtn.addEventListener('click', () => {
				this.handleAcceptRequest();
			});
		}

		// 拒绝申请按钮
		const rejectBtn = this.element.querySelector('[data-action="reject-request"]');
		if (rejectBtn) {
			rejectBtn.addEventListener('click', () => {
				this.handleRejectRequest();
			});
		}

		// 关闭反馈按钮
		const closeBtn = this.element.querySelector('[data-action="close-feedback"]');
		if (closeBtn) {
			closeBtn.addEventListener('click', () => {
				this.handleCloseFeedback();
			});
		}


		// 预览后退按钮
		const previewBackBtn = this.element.querySelector('[data-action="preview-history-back"]');
		if (previewBackBtn) {
			previewBackBtn.addEventListener('click', () => {
				this.previewHistoryBack();
			});
		}

		const previewForwardBtn = this.element.querySelector('[data-action="preview-history-forward"]');
		if (previewForwardBtn) {
			previewForwardBtn.addEventListener('click', () => {
				this.previewHistoryForward();
			});
		}

		// 文件链接点击事件
		const fileLinks = this.element.querySelectorAll('.file-link');
		fileLinks.forEach(link => {
			link.addEventListener('click', async (e) => {
				e.preventDefault();
				const path = e.currentTarget.dataset.path;
				if (path) {
					// 跳转到阅读页面
					await window.app.navigateTo(`/view?path=${encodeURIComponent(path)}`);
				}
			});
		});

		// 预览内容中的文章链接（使用 BasePage 的统一处理逻辑）
		this.handlePreviewLink();
	}

	/**
	 * 导航到文章（用于预览中的链接跳转）
	 * @param {string} path - 文章路径
	 */
	async navigateToArticle(path) {
		if (!path || !path.endsWith('.md')) return;
		await this.loadPreviewArticle(path);
	}

	/**
	 * 处理工具栏操作
	 * @param {string} action - 操作类型
	 */
	async handleToolbarAction(action) {
		switch (action) {
			case 'refresh':
				await this.loadData();
				break;
		}
	}

	/**
	 * 处理接受申请
	 * @returns {Promise<void>}
	 */
	async handleAcceptRequest() {
		const request = this.state.selectedRequest;
		if (!request) return;

		try {
			const previewData = await this.ensureRequestPreviewData(request);
			if (!previewData || !previewData.linkToFile) {
				alert(this.t('noticesPage.errors.invalidLink', '无法解析文件路径'));
				return;
			}

			const fullContent = this.buildFullContentFromPreview(previewData);
			console.log('fullContent', fullContent);
			const fileData = await window.StorageService.execute('files', 'get', previewData.linkToFile);
			fileData.content = fullContent;
			await window.StorageService.execute('files', 'put', fileData);
			await window.StorageService.savePendingFile(previewData.linkToFile);

			await this.closeIssueAndSendFeedback(request, true, previewData.linkToFile, previewData.requestFile);

			this.state.requests = this.state.requests.filter(r => r.number !== request.number);
			this.state.selectedRequest = null;
			this.resetRequestPreviewState();
			this.updateDOM();

		} catch (error) {
			console.error('接受申请失败:', error);
		}
	}

	/**
	 * 处理拒绝申请
	 * @returns {Promise<void>}
	 */
	async handleRejectRequest() {
		const request = this.state.selectedRequest;
		if (!request) return;

		// 显示拒绝理由输入模态框
		this.showRejectReasonModal(request);
	}

	/**
	 * 显示拒绝理由输入模态框
	 * @param {Object} request - 申请对象
	 */
	showRejectReasonModal(request) {
		const modal = document.createElement('div');
		modal.className = 'modal-overlay';
		modal.innerHTML = `
			<div class="modal-content" style="max-width: 600px;">
				<div class="modal-header">
					<h3>${this.escapeHtml(this.t('noticesPage.rejectReasonLabel', '拒绝理由'))}</h3>
				</div>
				<div class="modal-body">
					<div class="form-group">
						<label for="reject-reason-textarea">${this.escapeHtml(this.t('noticesPage.rejectReasonLabel', '拒绝理由'))}</label>
						<textarea
							id="reject-reason-textarea"
							class="notice-reason-textarea"
							rows="6"
							placeholder="${this.escapeHtmlAttribute(this.t('noticesPage.rejectReasonPlaceholder', '请输入拒绝理由（必填）'))}"
						>${this.escapeHtml(this.state.rejectReason || '')}</textarea>
						<div class="notice-reason-hint">${this.escapeHtml(this.t('noticesPage.rejectReasonHint', '拒绝申请时请说明理由，方便申请者改进。'))}</div>
					</div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" data-action="cancel-reject">${this.t('common.cancel', '取消')}</button>
					<button class="btn btn-primary" data-action="confirm-reject">${this.t('noticesPage.reject', '拒绝')}</button>
				</div>
			</div>
		`;

		// 添加到页面
		document.body.appendChild(modal);

		// 绑定事件
		const cancelBtn = modal.querySelector('[data-action="cancel-reject"]');
		const confirmBtn = modal.querySelector('[data-action="confirm-reject"]');
		const textarea = modal.querySelector('#reject-reason-textarea');

		// 聚焦到输入框
		setTimeout(() => textarea.focus(), 100);

		// 取消按钮
		const handleCancel = () => {
			document.body.removeChild(modal);
		};

		// 确认按钮
		const handleConfirm = async () => {
			const reason = (textarea.value || '').trim();
			if (!reason) {
				const infoModal = new window.Modal();
				infoModal.showInfo(
					this.t('common.info', '提示'),
					this.t('noticesPage.rejectReasonRequired', '请填写拒绝理由后再拒绝申请。'),
					{ showCancel: false }
				);
				return;
			}

			// 关闭模态框
			document.body.removeChild(modal);

			// 执行拒绝操作
			try {
				const parsed = this.parseIssueBody(request.body || '');
				// 关闭 Issue 并发送反馈
				await this.closeIssueAndSendFeedback(request, false, parsed.linkToFile, parsed.requestFile, reason);

				// 从列表中移除
				this.state.requests = this.state.requests.filter(r => r.number !== request.number);

				// 返回列表
				this.state.selectedRequest = null;
				this.resetRequestPreviewState();
				this.updateDOM();
			} catch (error) {
				console.error('拒绝申请失败:', error);
				alert(this.t('noticesPage.errors.rejectFailed', '拒绝申请失败: ') + error.message);
			}
		};

		cancelBtn.addEventListener('click', handleCancel);
		confirmBtn.addEventListener('click', handleConfirm);

		// 点击遮罩层关闭
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				handleCancel();
			}
		});

		// ESC 键关闭
		const handleKeyDown = (e) => {
			if (e.key === 'Escape') {
				handleCancel();
				document.removeEventListener('keydown', handleKeyDown);
			}
		};
		document.addEventListener('keydown', handleKeyDown);
	}

	/**
	 * 关闭 Issue 并发送反馈
	 * @param {Object} issue - Issue 对象
	 * @param {boolean} accepted - 是否接受
	 * @param {string} link - 请求连接到的文件路径
	 * @param {string} requestFile - 申请的文件路径
	 * @param {string} reason - 拒绝理由
	 * @returns {Promise<void>}
	 */
	async closeIssueAndSendFeedback(issue, accepted, link, requestFile, reason = '') {
		try {
			const { number } = issue;
			const repo = issue.repository_url.split('/').pop();
			const requestParsed = window.app.parsePath(requestFile);

			if (!requestParsed || !requestParsed.owner || !requestParsed.repo) {
				throw new Error('无法解析申请文件路径，无法确定申请者仓库');
			}

			// 申请者的仓库信息
			const applicantOwner = requestParsed.owner;
			const applicantRepo = requestParsed.repo;

			// 构建反馈消息
			let feedbackMessage = '';

			if (accepted) {
				// 接受：只发送申请添加的链接
				feedbackMessage = `✅ **Accepted**: ${requestFile}`;
			} else {
				// 拒绝：发送申请的链接和拒绝的理由
				feedbackMessage = `❌ **Rejected**: ${link}
**Reason**: ${reason}`;
			}

			// 创建 issue 标题
			const issueTitle = 'Application result:';

			await window.GitHubService.safeCall(async (octokit) => {
				// 在申请者的仓库中创建 issue（无标签）
				await octokit.rest.issues.create({
					owner: applicantOwner,
					repo: applicantRepo,
					title: issueTitle,
					body: feedbackMessage,
					labels: [] // 无标签
				});

				// 关闭自己的 issue
				await octokit.rest.issues.update({
					owner: window.app.user.username,
					repo,
					issue_number: number,
					state: 'closed'
				});
			});
			// 更新未读Issues列表
			window.app.issues = window.app.issues.filter(issue => issue.number !== number);
			this.handleIssues();
		} catch (error) {
			console.error('关闭 Issue 并发送反馈失败:', error);
			throw error;
		}
	}

	/**
	 * 处理关闭反馈
	 * @returns {Promise<void>}
	 */
	async handleCloseFeedback() {
		const feedback = this.state.selectedFeedback;
		if (!feedback) return;

		try {
			const { number } = feedback;
			const repo = feedback.repository_url.split('/').pop();

			// 解析反馈内容，获取是否接受以及关联的文件路径
			const parsed = this.parseFeedbackBody(feedback.body || '');
			const linkPath = parsed.link;

			// 如果 Issue 还未关闭，先关闭它
			if (feedback.state === 'open') {
				await window.GitHubService.safeCall(async (octokit) => {
					await octokit.rest.issues.update({
						owner: window.app.user.username,
						repo,
						issue_number: number,
						state: 'closed'
					});
				});
			}
			// 更新未读Issues列表
			window.app.issues = window.app.issues.filter(issue => issue.number !== number);
			this.handleIssues();
			// 根据反馈结果执行操作
			if (linkPath) {
				if (parsed.accepted) {
					// 更新 links 表：将 state 改为 2（已批准）
					try {
						const allLinks = await window.StorageService.execute('links', 'getAll');
						const matchingLinks = allLinks.filter(link => link.remotePath === linkPath);
						for (const link of matchingLinks) {
							link.state = 2; // 2-已批准
							await window.StorageService.execute('links', 'put', link);
						}
					} catch (e) {
						console.error('更新 links 表失败:', linkPath, e);
					}

					// 从列表中移除
					this.state.feedback = this.state.feedback.filter(f => f.number !== feedback.number);

					// 返回列表
					this.state.selectedFeedback = null;
					this.updateDOM();
				} else {
					// 拒绝：删除 links 表中的记录
					try {
						const allLinks = await window.StorageService.execute('links', 'getAll');
						const matchingLinks = allLinks.filter(link => link.remotePath === linkPath);
						for (const link of matchingLinks) {
							await window.StorageService.execute('links', 'delete', link.id);
						}
					} catch (e) {
						console.error('删除 links 表记录失败:', linkPath, e);
					}

					// 跳转到编辑页面
					try {
						await window.app.navigateTo(`/editor?path=${encodeURIComponent(linkPath)}`);
					} catch (e) {
						console.error('跳转到编辑页面失败:', linkPath, e);
					}
				}
			}

		} catch (error) {
			console.error('关闭反馈失败:', error);
		}
	}

	/**
	 * 获取相对路径
	 * @param {string} fromPath - 源文件路径
	 * @param {string} toPath - 目标文件路径
	 * @returns {string} 相对路径
	 */
	getRelativePath(fromPath, toPath) {
		const fromParsed = window.app.parsePath(fromPath);
		const toParsed = window.app.parsePath(toPath);

		if (!fromParsed || !toParsed) return fromPath;

		// 如果是同一仓库，返回相对路径
		const fromRepo = `${fromParsed.owner}/${fromParsed.repo}`;
		const toRepo = `${toParsed.owner}/${toParsed.repo}`;

		if (fromRepo === toRepo) {
			// 同一仓库，返回相对于仓库根目录的路径
			if (toParsed.dirPath) {
				return `${toParsed.dirPath}/${toParsed.fullFilename}`;
			}
			return toParsed.fullFilename;
		}

		// 不同仓库，返回完整路径（不含扩展名的相对路径格式）
		if (toParsed.dirPath) {
			return `${toRepo}/${toParsed.dirPath}/${toParsed.filename}`;
		}
		return `${toRepo}/${toParsed.filename}`;
	}

	/**
	 * 转义正则表达式
	 * @param {string} str - 字符串
	 * @returns {string} 转义后的字符串
	 */
	escapeRegex(str) {
		if (typeof str !== 'string') return '';
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * 获取本地化后的请求标题
	 * @param {string} title - 标题
	 * @returns {string} 本地化后的标题
	 */
	getLocalizedRequestTitle(title) {
		if (!title) return '';
		const localizedPrefix = this.t('noticesPage.linkRequest', '链接申请');
		return title.replace(/^Link Request/i, localizedPrefix);
	}

	/**
	 * 标准化路径
	 * @param {string} path - 路径
	 * @param {string} basePath - 基础路径
	 * @returns {string} 标准化后的路径
	 */
	normalizePath(path, basePath = '') {
		if (!path) return '';
		const parsed = window.app.parsePath(path);
		if (parsed) {
			return [
				parsed.owner,
				parsed.repo,
				parsed.dirPath ? parsed.dirPath : null,
				parsed.fullFilename || parsed.filename
			].filter(Boolean).join('/');
		}
		return this.resolveRelativePath(basePath, path);
	}

	/**
	 * 解析相对路径
	 * @param {string} basePath - 基础路径
	 * @param {string} relativePath - 相对路径
	 * @returns {string} 解析后的路径
	 */
	resolveRelativePath(basePath, relativePath) {
		if (!relativePath) return relativePath;
		const cleanedRelative = relativePath.replace(/^\.\//, '');

		// 如果 relativePath 看起来已经是完整路径（包含至少 owner/repo/file.ext），直接返回
		const relativeParsed = window.app.parsePath(cleanedRelative);
		if (relativeParsed && relativeParsed.owner && relativeParsed.repo) {
			return cleanedRelative;
		}

		let baseParsed = window.app.parsePath(basePath || '');
		// 只有在 basePath 能解析时才使用，否则不使用 current_repo（避免错误）
		if (!baseParsed) {
			console.warn('⚠️ [resolveRelativePath] basePath 无法解析，且 relativePath 也不是完整路径，返回原路径');
			return relativePath;
		}

		const repoPath = `${baseParsed.owner}/${baseParsed.repo}`;

		const baseSegments = baseParsed?.dirPath ? baseParsed.dirPath.split('/').filter(Boolean) : [];
		const relativeSegments = cleanedRelative.split('/').filter(segment => segment.length > 0);

		for (const segment of relativeSegments) {
			if (segment === '.') continue;
			if (segment === '..') {
				if (baseSegments.length > 0) {
					baseSegments.pop();
				}
				continue;
			}
			baseSegments.push(segment);
		}

		const joined = baseSegments.join('/');
		return joined ? `${repoPath}/${joined}` : `${repoPath}`;
	}

	/**
	 * 加载文件内容
	 * @param {string} path - 文件路径
	 * @param {string} basePath - 基础路径
	 * @returns {Promise<Object>} 文件数据和标准化路径
	 */
	async loadFileContent(path, basePath = '') {
		if (!path) return { fileData: null, normalizedPath: path };

		console.log('🔍 [loadFileContent] 原始路径:', path);
		console.log('🔍 [loadFileContent] basePath:', basePath);

		// 先尝试直接解析路径，如果解析成功就直接使用
		const parsed = window.app.parsePath(path);
		console.log('🔍 [loadFileContent] parsePath 结果:', parsed);

		let normalizedPath = path;
		if (parsed && parsed.owner && parsed.repo) {
			// 路径格式正确，直接使用解析结果
			normalizedPath = [
				parsed.owner,
				parsed.repo,
				parsed.dirPath ? parsed.dirPath : null,
				parsed.fullFilename || parsed.filename
			].filter(Boolean).join('/');
			console.log('🔍 [loadFileContent] 使用解析结果:', normalizedPath);
		} else if (basePath) {
			// 如果路径解析失败，且有 basePath，尝试作为相对路径解析
			normalizedPath = this.resolveRelativePath(basePath, path);
			console.log('🔍 [loadFileContent] 使用相对路径解析:', normalizedPath);
		} else {
			console.log('🔍 [loadFileContent] 保持原路径:', normalizedPath);
		}

		let fileData = await window.StorageService.execute('files', 'get', normalizedPath).catch(() => null);

		if (!fileData || !fileData.content) {
			try {
				fileData = await new Promise((resolve, reject) => {
					window.StorageService.downloadFile(normalizedPath, (result) => {
						if (result) {
							resolve(result);
						} else {
							reject(new Error('download_failed'));
						}
					});
				});
			} catch (error) {
				console.error('下载文件失败:', path, error);
				return null;
			}
		}

		return { fileData, normalizedPath };
	}

	/**
	 * 更新DOM
	 */
	updateDOM() {
		if (!this.element) return;

		// 更新标签页
		const tabs = this.element.querySelector('.tabs');
		if (tabs) {
			tabs.outerHTML = this.renderTabs();
		}

		// 更新内容区
		const contentArea = this.element.querySelector('.notices-content');
		if (contentArea) {
			const currentContent = contentArea.querySelector('.tabs, .notices-list, .notice-detail, .loading, .empty, .empty-message');
			if (currentContent) {
				contentArea.innerHTML = `
					${this.renderTabs()}
					${this.renderContent()}
				`;
			}
		}

		// 重新绑定事件
		this.bindEvents();

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}

		// 加载预览中的媒体文件（图片和音频）
		// 延迟加载，确保DOM已更新
		setTimeout(() => {
			this.loadMediaElements();
		}, 100);

	}

	/**
	 * 注销组件
	 */
	destroy() {
		super.destroy();
	}
}

// 注册组件
window.NoticesPage = NoticesPage;