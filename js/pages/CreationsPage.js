/**
 * 项目列表页面组件
 * 允许用户选择现有仓库或创建新仓库
 * @class
 * @extends {BasePage}
 */
class CreationsPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.state = {
			formData: {
				repositoryUrl: 'https://github.com/ZelaCreator/zela_planet',
				name: '',
				repo: '',
				penName: '',
				language: window.app.setting.language,
				category: '',
				description: ''
			},
			loading: false,
			selectedTab: 'recent', // 'recent'、'existing' 或 'create'
			repositoryHistory: [],
			creationsList: [], // 从 creations.tsv 获取的全部作品列表
			filteredCreationsList: [], // 过滤后的作品列表
			searchQuery: '', // 搜索关键词
			creationsLoading: false, // 是否正在加载作品列表
			creationsError: null, // 加载错误信息
			currentLoadingItem: null, // 当前正在加载的作品项元素
			currentLoadingIndicator: null // 当前正在加载的作品项的加载指示器
		};
	}

	/**
	 * 挂载组件到DOM
	 * @param {HTMLElement} element - 挂载的容器元素
	 */
	async mount(element) {
		// 加载用户信息和仓库历史
		await this.loadRepositoryHistory();

		// 根据是否有历史记录设置默认标签页
		// 如果有历史记录，显示 recent 标签页；如果没有，显示 existing 标签页
		if (this.state.repositoryHistory.length === 0) {
			this.state.selectedTab = 'existing';
		} else {
			this.state.selectedTab = 'recent';
		}

		this.element = element;
		this.element.innerHTML = '';
		this.element.appendChild(this.render());
		this.bindEvents();
	}

	/**
	 * 渲染页面主容器
	 * @returns {HTMLElement} 仓库选择页面的容器元素
	 */
	render() {
		const container = document.createElement('div');
		container.className = 'repository-selection-container';
		container.innerHTML = `
			${this.renderHeader()}
			${this.renderTabs()}
			${this.renderContent()}
		`;
		return container;
	}

	/**
	 * 加载仓库历史记录
	 */
	async loadRepositoryHistory() {
		try {
			const history = await window.StorageService.getCreations();
			if (history && Array.isArray(history)) {
				this.state.repositoryHistory = history;
				console.log('已加载仓库历史记录:', this.state.repositoryHistory.length, '个仓库');
			}
		} catch (error) {
			console.warn('加载仓库历史记录失败:', error);
		}
	}

	/**
	 * 从 GitHub 获取 creations.zip 文件
	 * @async
	 * @param {boolean} forceReload - 是否强制重新加载
	 */
	async loadCreationsList(forceReload = false) {
		// 如果正在加载中，不重复加载
		if (this.state.creationsLoading) {
			return;
		}

		// 如果已经有数据且不是强制重新加载，则不加载
		if (!forceReload && this.state.creationsList.length > 0 && !this.state.creationsError) {
			return;
		}

		this.state.creationsLoading = true;
		this.state.creationsError = null;

		try {
			// 从 GitHub raw 内容 URL 获取文件
			let url = 'https://raw.githubusercontent.com/DIPCNPO/creations/main/creations.zip';
			let response = await fetch(url);

			if (!response.ok) {
				url = 'https://raw.githubusercontent.com/DIPCNPO/creations/main/creations.tsv';
				response = await fetch(url);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				} else {
					const content = await response.text();
					this.handleCreationsList(content);
				}
			} else {
				// 解压缩 - 需要将 response 转换为 ArrayBuffer
				const arrayBuffer = await response.arrayBuffer();
				const zip = await JSZip.loadAsync(arrayBuffer);
				let tsvFile = zip.file('tmp/creations.tsv');

				if (tsvFile) {
					// 确保不是目录，然后读取内容
					const content = await tsvFile.async('text');
					this.handleCreationsList(content);
					return; // 成功加载，直接返回
				}

				// 如果 ZIP 中确实没有找到文件，抛出错误而不是回退下载
				throw new Error(`ZIP 文件中未找到 creations.tsv 文件。ZIP 文件包含: ${fileNames.join(', ')}`);
			}
		} catch (error) {
			console.error('加载 creations.tsv 失败:', error);
			this.state.creationsLoading = false;
			this.state.creationsError = error.message;
		}
	}

	/**
	 * 处理作品列表
	 * @param {string} content - creations.tsv 内容
	 */
	handleCreationsList(content) {
		const data = content.split('\n').map(line => line.split('\t'));

		// 删除表头和空行（在转换为对象之前处理）
		const filteredData = data.filter((item, idx) => {
			// 跳过第一行（表头）
			if (idx === 0) return false;
			// 跳过所有字段皆为空（常见于最后空行）
			return item.some(field => field && field.trim() !== '');
		});

		// 将过滤后的数据转换为对象数组
		const creationsList = filteredData.map(item => {
			return {
				repository: item[0],
				createdAt: item[1],
				name: item[2],
				description: item[3],
				language: item[4],
				category: item[5],
				articles: item[6],
				authors: item[7],
				readers: item[8],
				likes: item[9],
				hates: item[10],
				pass: item[11],
				daily_voting: item[12],
			};
		});

		this.state.creationsList = creationsList;

		// TODO:更新过滤列表
		this.state.filteredCreationsList = creationsList;
		this.state.creationsLoading = false;
		this.state.creationsError = null;

		// 如果当前选项卡是 existing，更新内容
		if (this.element && this.state.selectedTab === 'existing') {
			this.updateContent();
		}
	}

	/**
	 * 保存仓库到历史记录
	 * @param {Object} repoInfo - 仓库信息
	 */
	async saveToHistory(repoInfo) {
		// 检查是否已存在
		const existingIndex = this.state.repositoryHistory.findIndex(item =>
			item.repository === repoInfo.repository
		);

		if (existingIndex >= 0) {
			// 更新访问时间
			this.state.repositoryHistory[existingIndex].last_read = new Date().toISOString();
			await window.StorageService.updateCreation(this.state.repositoryHistory[existingIndex]);
		} else {
			// 添加新记录
			repoInfo.last_read = new Date().toISOString();
			await window.StorageService.updateCreation(repoInfo);
			this.state.repositoryHistory.unshift(repoInfo);
		}

	}

	/**
	 * 渲染页面头部
	 * @returns {string} 头部的HTML字符串
	 */
	renderHeader() {
		return `
            <div class="page-header">
                <h1>${this.t('repositorySelection.title', '选择作品')}</h1>
            </div>
        `;
	}

	/**
	 * 渲染标签页
	 * @returns {string} 标签页的HTML字符串
	 */
	renderTabs() {
		return `
            <div class="tabs">
                <button class="tab-button ${this.state.selectedTab === 'recent' ? 'active' : ''}" 
                        data-tab="recent">
                    <span class="tab-icon">🕒</span>
                </button>
                <button class="tab-button ${this.state.selectedTab === 'existing' ? 'active' : ''}" 
                        data-tab="existing">
                    <span class="tab-icon">📁</span>
                </button>
                <button class="tab-button ${this.state.selectedTab === 'create' ? 'active' : ''}" 
                        data-tab="create">
                    <span class="tab-icon">➕</span>
                </button>
            </div>
        `;
	}

	/**
	 * 渲染内容区域
	 * @returns {string} 内容区域的HTML字符串
	 */
	renderContent() {
		if (this.state.selectedTab === 'recent') {
			return this.renderRecentRepositoryTab();
		} else if (this.state.selectedTab === 'existing') {
			return this.renderExistingRepositoryTab();
		} else {
			return this.renderCreateRepositoryTab();
		}
	}

	/**
	 * 渲染最近访问仓库标签页
	 * @returns {string} 最近访问仓库标签页的HTML字符串
	 */
	renderRecentRepositoryTab() {
		return `
            <div class="tab-content">
                ${this.renderRepositoryHistory()}
                ${this.renderRepositoryUrlInput()}
                ${this.renderContinueButton()}
            </div>
        `;
	}

	/**
	 * 渲染选择现有仓库标签页
	 * @returns {string} 现有仓库标签页的HTML字符串
	 */
	renderExistingRepositoryTab() {
		// 触发加载 creations.tsv（如果还未加载，或者之前加载失败）
		if (!this.state.creationsLoading) {
			if (this.state.creationsList.length === 0 || this.state.creationsError) {
				this.loadCreationsList(!!this.state.creationsError); // 如果有错误，强制重新加载
			}
		}

		return `
            <div class="tab-content">
                ${this.renderCreationsList()}
            </div>
        `;
	}

	/**
	 * 渲染作品列表（从 creations.tsv 获取）
	 * @returns {string} 作品列表的HTML字符串
	 */
	renderCreationsList() {
		if (this.state.creationsLoading) {
			return `
                <div class="repository-history">
                    <h3>${this.t('repositorySelection.title', '作品列表')}</h3>
                    <p class="no-history">${this.t('common.loading', '正在加载...')}</p>
                </div>
            `;
		}

		if (this.state.creationsError) {
			return `
                <div class="repository-history">
                    <h3>${this.t('repositorySelection.title', '作品列表')}</h3>
                    <div class="error-message">
                        <p>${this.t('repositorySelection.existing.error', '加载失败')}: ${this.escapeHtml(this.state.projectsError)}</p>
                        <button class="retry-btn" id="retry-load-projects">${this.t('repositorySelection.existing.retry', '重试')}</button>
                    </div>
                </div>
            `;
		}

		// 显示搜索框
		const searchInput = `
            <div class="search-container">
                <input type="text" id="projects-search-input" class="search-input" 
                    placeholder="${this.tAttr('repositorySelection.existing.searchPlaceholder', '根据作者或简介搜索...')}" 
                    value="${this.escapeHtmlAttribute(this.state.searchQuery)}">
                ${this.state.searchQuery ? `<button id="clear-search-btn" class="clear-search-btn" title="${this.tAttr('common.clear', '清除')}">×</button>` : ''}
            </div>
        `;

		// 使用过滤后的列表
		const displayList = this.state.filteredCreationsList || this.state.creationsList;

		if (displayList.length === 0) {
			return `
                <div class="repository-history">
                    <h3>${this.t('repositorySelection.title', '作品列表')}</h3>
                    ${searchInput}
                    <p class="no-history">${this.state.searchQuery ? this.t('repositorySelection.existing.noResults', '没有找到匹配的仓库') : this.t('repositorySelection.existing.empty', '暂无可用仓库')}</p>
                </div>
            `;
		}

		const creationItems = displayList.map((creation) => `
            <div class="history-item clickable" data-repository="${this.escapeHtmlAttribute(creation.repository)}">
                <div class="repo-info">
                    <h4>${this.escapeHtml(creation.name)} (${this.escapeHtml(creation.repository)})</h4>
                    <p class="repo-description">${this.escapeHtml(creation.description || this.t('repositorySelection.existing.noDescription', '无描述'))}</p>
                    ${creation.createdAt ? `<p class="last-accessed">${this.t('repositorySelection.existing.createdAt', '创建时间')}: ${this.escapeHtml(window.I18nService.formatDate(creation.createdAt))}</p>` : ''}
                </div>
            </div>
        `).join('');

		return `
            <div class="repository-history">
                <div class="repository-history-header">
                    <h3>${this.t('repositorySelection.title', '作品列表')}</h3>
                    <button class="refresh-btn" id="refresh-projects-btn" title="${this.tAttr('common.refresh', '刷新')}">
                        <span class="refresh-icon">🔄</span>
                    </button>
                </div>
                ${searchInput}
                <div class="history-list">
                    ${creationItems}
                </div>
            </div>
        `;
	}

	/**
	 * 过滤作品列表（根据作者或简介）
	 * @param {string} query - 搜索关键词
	 */
	filterCreationsList(query) {
		const searchQuery = query.toLowerCase().trim();
		this.state.searchQuery = searchQuery;

		if (!searchQuery) {
			this.state.filteredCreationsList = this.state.creationsList;
			return;
		}

		const filtered = this.state.creationsList.filter(creation => {
			// 搜索作者（owner）
			const ownerMatch = creation.owner.toLowerCase().includes(searchQuery);
			// 搜索仓库名（repo）
			const repoMatch = creation.repo.toLowerCase().includes(searchQuery);
			// 搜索简介（description）
			const descMatch = creation.description && creation.description.toLowerCase().includes(searchQuery);

			return ownerMatch || repoMatch || descMatch;
		});

		this.state.filteredCreationsList = filtered;
	}

	/**
	 * 渲染仓库历史记录
	 * @returns {string} 仓库历史记录的HTML字符串
	 */
	renderRepositoryHistory() {
		if (this.state.repositoryHistory.length === 0) {
			return `
                <div class="repository-history">
                    <h3>${this.t('repositorySelection.history.title', '最近访问的仓库')}</h3>
                    <p class="no-history">${this.t('repositorySelection.history.empty', '暂无历史记录')}</p>
                </div>
            `;
		}

		const repos = this.state.repositoryHistory.sort((a, b) => b.last_read - a.last_read);

		const historyItems = repos.map(repo => `
            <div class="history-item clickable" data-repository="${this.escapeHtmlAttribute(repo.repository)}">
                <div class="repo-info">
                    <h4>${this.escapeHtml(repo.name)} (${this.escapeHtml(repo.repository)})</h4>
                    <p class="repo-description">${this.escapeHtml(repo.description || this.t('repositorySelection.history.noDescription', '无描述'))}</p>
                    <p class="last-accessed">${this.t('repositorySelection.history.lastAccessed', '最后访问')}: ${this.escapeHtml(window.I18nService.formatDate(repo.last_read))}</p>
                </div>
            </div>
        `).join('');

		return `
            <div class="repository-history">
                <h3>${this.t('repositorySelection.history.title', '最近访问的仓库')}</h3>
                <div class="history-list">
                    ${historyItems}
                </div>
            </div>
        `;
	}

	/**
	 * 渲染仓库URL输入
	 * @returns {string} 仓库URL输入的HTML字符串
	 */
	renderRepositoryUrlInput() {
		return `
            <div class="repository-url-input">
                <h3>${this.t('repositorySelection.urlInput.title', '或输入仓库地址')}</h3>
                <div class="form-group">
                    <label for="repository-url">${this.t('repositorySelection.urlInput.label', 'GitHub仓库URL')}</label>
                    <input type="url" id="repository-url" 
                        placeholder="${this.tAttr('repositorySelection.urlInput.placeholder', 'https://github.com/owner/repo')}" 
                        value="${this.escapeHtmlAttribute(this.state.formData.repositoryUrl)}">
                    <p class="help-text">${this.t('repositorySelection.urlInput.help', '请输入完整的GitHub仓库地址')}</p>
                </div>
            </div>
        `;
	}

	/**
	 * 渲染创建仓库标签页
	 * @returns {string} 创建仓库标签页的HTML字符串
	 */
	renderCreateRepositoryTab() {
		const options = window.I18nService.supportedLanguages.map(lang => {
			const isSelected = window.app.setting.language === lang ? 'selected' : '';
			const displayName = window.I18nService.getLanguageDisplayName(lang);
			return `<option value="${lang}" ${isSelected}>${displayName}</option>`;
		}).join('');

		return `
            <div class="tab-content">
                <div class="create-repository-form">
                    <h3>${this.t('repositorySelection.create.title', '创建新作品')}</h3>
					<div class="form-group">
						<label for="language-select">${this.t('repositorySelection.create.languageLabel', '语言')}</label>
						<select id="new-repo-language" aria-label="language-select">
							${options}
						</select>
					</div>
                    <div class="form-group">
                        <label for="new-repo-name">${this.t('repositorySelection.create.penNameLabel', '笔名')}</label>
                        <input type="text" id="new-repo-penName" 
                            placeholder="${this.tAttr('repositorySelection.create.penNamePlaceholder', '100字符以内')}" 
                            value="${this.escapeHtmlAttribute(this.state.formData.penName)}" required>
                    </div>
                    <div class="form-group">
                        <label for="new-repo-name">${this.t('repositorySelection.create.nameLabel', '作品名称')}</label>
                        <input type="text" id="new-repo-name" 
                            placeholder="${this.tAttr('repositorySelection.create.categoryPlaceholder', '100字符以内')}" 
                            value="${this.escapeHtmlAttribute(this.state.formData.name)}" required>
                    </div>
                    <div class="form-group">
                        <label for="new-repo-name">${this.t('repositorySelection.create.repoLabel', '仓库名称')}</label>
                        <input type="text" id="new-repo-repo" 
                            placeholder="${this.tAttr('repositorySelection.create.repoPlaceholder', '英文数字，100字符以内')}" 
                            value="${this.escapeHtmlAttribute(this.state.formData.repo)}" required>
                    </div>
                    <div class="form-group">
                        <label for="new-repo-name">${this.t('repositorySelection.create.categoryLabel', '类别')}</label>
                        <input type="text" id="new-repo-category" 
                            placeholder="${this.tAttr('repositorySelection.create.categoryPlaceholder', '100字符以内')}" 
                            value="${this.escapeHtmlAttribute(this.state.formData.category)}" required>
                    </div>
                    <div class="form-group">
                        <label for="new-repo-description">${this.t('repositorySelection.create.descriptionLabel', '仓库描述')}</label>
                        <textarea id="new-repo-description" 
                            placeholder="${this.tAttr('repositorySelection.create.descriptionPlaceholder', '仓库的简短描述，350字符以内')}" 
                            rows="3">${this.escapeHtml(this.state.formData.description)}</textarea>
                    </div>
                </div>
                ${this.renderContinueButton()}
            </div>
        `;
	}

	/**
	 * 渲染继续按钮
	 * @returns {string} 继续按钮的HTML字符串
	 */
	renderContinueButton() {
		const loadingClass = this.state.loading ? 'loading' : '';
		const disabledAttr = this.state.loading ? 'disabled' : '';

		return `
            <div class="continue-button-container">
                <button id="continue-btn" class="btn btn-primary ${loadingClass}" ${disabledAttr}>
                    <span class="btn-text">${this.state.loading ? this.t('repositorySelection.continue.loading', '处理中...') : this.t('repositorySelection.continue.button', '继续')}</span>
                </button>
            </div>
        `;
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		// 标签页切换
		const tabButtons = this.element.querySelectorAll('.tab-button');
		tabButtons.forEach(button => {
			button.addEventListener('click', (e) => {
				// 如果正在处理中，阻止切换选项卡
				if (this.state.loading || button.disabled) {
					return;
				}

				const tab = e.currentTarget.dataset.tab;
				this.state.selectedTab = tab;
				// 更新选项卡样式
				this.updateTabsActiveState();
				// 更新内容区域
				this.updateContent();
			});
		});

		// 历史记录和项目列表选择（整个区域可点击）
		const historyItems = this.element.querySelectorAll('.history-item.clickable');
		historyItems.forEach(item => {
			item.addEventListener('click', async (e) => {
				// 如果正在加载，阻止重复点击
				if (this.state.loading) {
					return;
				}

				// 检查元素是否已被禁用
				if (item.style.pointerEvents === 'none') {
					return;
				}

				const repository = item.dataset.repository; // 项目列表中的项有 data-repository 属性

				// 构建仓库URL
				const repositoryUrl = `https://github.com/${repository}`;

				// 设置仓库URL到表单数据
				this.state.formData.repositoryUrl = repositoryUrl;

				// 高亮选中的项
				const allItems = this.element.querySelectorAll('.history-item');
				allItems.forEach(i => {
					i.classList.remove('selected');
					if (i.dataset.repository === repository) {
						i.classList.add('selected');
					}
				});

				// 先改变点击项目的光标状态为等待
				item.style.cursor = 'wait';
				item.style.opacity = '1'; // 恢复点击项的不透明度，让它更突出

				// 在当前项目项中显示加载状态
				const loadingIndicator = document.createElement('span');
				loadingIndicator.className = 'loading-indicator';
				loadingIndicator.textContent = '⏳ ' + this.t('repositorySelection.continue.loading', '处理中...');
				loadingIndicator.style.marginLeft = '10px';
				loadingIndicator.style.color = 'var(--primary-color, #0366d6)';
				loadingIndicator.style.fontWeight = 'bold';
				const repoInfo = item.querySelector('.repo-info');
				if (repoInfo) {
					repoInfo.appendChild(loadingIndicator);
				}

				// 保存当前加载的项目项和指示器引用，以便在同步进度中更新
				this.state.currentLoadingItem = item;
				this.state.currentLoadingIndicator = loadingIndicator;

				// 禁用所有可点击项，防止重复点击（但要排除当前点击的项目项，保持其可交互以显示等待光标）
				const allClickableItems = this.element.querySelectorAll('.history-item.clickable');
				allClickableItems.forEach(i => {
					if (i !== item) {
						i.style.pointerEvents = 'none';
						i.style.cursor = 'not-allowed';
						i.style.opacity = '0.6';
					}
				});

				// 在整个文档或容器上设置等待光标，确保鼠标悬停时显示
				const container = this.element.closest('.dashboard') || this.element;
				if (container) {
					container.style.cursor = 'wait';
				}

				// 禁用选项卡按钮
				this.disableTabButtons(true);

				// 直接打开项目详情页
				try {
					await this.handleExistingRepository();
				} catch (error) {
					console.error('打开作品失败:', error);
					// 恢复选项卡按钮
					this.disableTabButtons(false);
				}
				// 注意：如果成功，会导航到其他页面，所以不需要恢复状态
			});
		});

		// 重试加载 creations.tsv 按钮
		const retryBtn = this.element.querySelector('#retry-load-projects');
		if (retryBtn) {
			retryBtn.addEventListener('click', () => {
				this.state.creationsList = [];
				this.state.projectsError = null;
				this.loadCreationsList(true); // 强制重新加载
			});
		}

		// 刷新项目列表按钮
		const refreshBtn = this.element.querySelector('#refresh-projects-btn');
		if (refreshBtn) {
			refreshBtn.addEventListener('click', () => {
				// 如果正在处理中，阻止刷新
				if (this.state.loading || refreshBtn.disabled) {
					return;
				}
				this.loadCreationsList(true); // 强制重新加载
			});
		}

		// 搜索输入框
		const searchInput = this.element.querySelector('#projects-search-input');
		if (searchInput) {
			searchInput.addEventListener('input', (e) => {
				this.filterCreationsList(e.target.value);
				// 更新内容以重新渲染列表
				this.updateContent();
			});
		}

		// 清除搜索按钮
		const clearSearchBtn = this.element.querySelector('#clear-search-btn');
		if (clearSearchBtn) {
			clearSearchBtn.addEventListener('click', () => {
				this.filterCreationsList('');
				this.updateContent();
			});
		}

		// 继续按钮
		const continueBtn = this.element.querySelector('#continue-btn');
		if (continueBtn) {
			continueBtn.addEventListener('click', () => {
				this.handleContinue();
			});
		}

		// 作品名称输入框自动填充到仓库名称
		const nameInput = this.element.querySelector('#new-repo-name');
		if (nameInput) {
			const repoInput = this.element.querySelector('#new-repo-repo');
			if (!repoInput) return;

			// 已确认的仓库名称值（永远不清空）
			let confirmedRepoValue = '';

			// 监听 keyup 事件，处理删除键和字符输入
			nameInput.addEventListener('keyup', (e) => {
				const key = e.key;

				if (key === 'Backspace' || key === 'Delete') {
					const currentNameValue = nameInput.value || '';
					const repoValue = currentNameValue.replace(/\s/g, '_');
					const filteredValue = repoValue.replace(/[^a-zA-Z0-9\-_]/g, '');

					// 如果输入框为空，允许清空；如果输入框不为空但过滤后为空（比如只有中文），保持已确认的值不变
					if (currentNameValue === '') {
						// 输入框为空，允许清空
						confirmedRepoValue = '';
					} else if (filteredValue) {
						// 输入框不为空且过滤后有值，更新
						confirmedRepoValue = filteredValue;
					}
					// 否则（输入框不为空但过滤后为空），保持 confirmedRepoValue 不变

					repoInput.value = confirmedRepoValue;
					this.state.formData.repo = confirmedRepoValue;
				} else if (key && key !== 'Process' && key.length === 1) {
					// 处理字符输入
					const allowedPattern = /^[a-zA-Z0-9\-_\s]$/;
					if (allowedPattern.test(key)) {
						// 过滤字符（空格转为下划线）
						const filteredChar = key === ' ' ? '_' : key.replace(/[^a-zA-Z0-9\-_]/g, '');
						if (filteredChar) {
							confirmedRepoValue += filteredChar;
							repoInput.value = confirmedRepoValue;
							this.state.formData.repo = confirmedRepoValue;
						}
					}
				}
			});
		}

		// 表单输入
		const inputs = this.element.querySelectorAll('input, textarea, select');
		inputs.forEach(input => {
			input.addEventListener('input', (e) => {
				let fieldName = e.target.id.replace('new-repo-', '').replace('repository-', '');
				if (fieldName === 'url') fieldName = 'repositoryUrl';
				if (fieldName === 'penName') fieldName = 'penName';
				if (fieldName === 'name') fieldName = 'name';
				if (fieldName === 'repo') fieldName = 'repo';
				if (fieldName === 'category') fieldName = 'category';
				if (fieldName === 'language') fieldName = 'language';
				if (fieldName === 'description') fieldName = 'description';
				this.state.formData[fieldName] = e.target.value.replace("\r", "").replace("\n", "");
			});
		});
	}

	/**
	 * 更新内容区域
	 */
	updateContent() {
		const contentContainer = this.element.querySelector('.tab-content');
		if (contentContainer) {
			contentContainer.innerHTML = this.renderContent();
			this.bindEvents();
			// 内容更新后也同步一次tab按钮的active状态
			this.updateTabsActiveState();
		}
	}

	/**
	 * 更新选项卡按钮的激活样式
	 */
	updateTabsActiveState() {
		if (!this.element) return;
		const tabButtons = this.element.querySelectorAll('.tab-button');
		tabButtons.forEach(btn => {
			const isActive = btn.dataset.tab === this.state.selectedTab;
			btn.classList.toggle('active', !!isActive);
		});
	}

	/**
	 * 从历史记录选择仓库
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 */
	selectRepositoryFromHistory(owner, repo) {
		const repositoryUrl = `https://github.com/${owner}/${repo}`;
		this.state.formData.repositoryUrl = repositoryUrl;

		// 更新输入框值
		const urlInput = this.element.querySelector('#repository-url');
		if (urlInput) {
			urlInput.value = repositoryUrl;
		}

		// 高亮选中的历史记录项
		const historyItems = this.element.querySelectorAll('.history-item');
		historyItems.forEach(item => {
			item.classList.remove('selected');
			if (item.dataset.owner === owner && item.dataset.repo === repo) {
				item.classList.add('selected');
			}
		});
	}

	/**
	 * 从项目列表选择仓库
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {string} url - 仓库完整 URL
	 */
	selectRepositoryFromProjects(owner, repo, url) {
		this.state.formData.repositoryUrl = url;

		// 更新输入框值
		const urlInput = this.element.querySelector('#repository-url');
		if (urlInput) {
			urlInput.value = url;
		}

		// 高亮选中的项目项
		const projectItems = this.element.querySelectorAll('.history-item');
		projectItems.forEach(item => {
			item.classList.remove('selected');
			if (item.dataset.owner === owner && item.dataset.repo === repo) {
				item.classList.add('selected');
			}
		});
	}

	/**
	 * 处理继续操作
	 * @async
	 */
	async handleContinue() {
		if (this.state.loading) return;

		try {
			this.state.loading = true;
			this.updateContinueButtonState('loading', this.t('repositorySelection.continue.loading', '处理中...'));
			// 禁用选项卡按钮
			this.disableTabButtons(true);

			if (this.state.selectedTab === 'existing' || this.state.selectedTab === 'recent') {
				await this.handleExistingRepository();
			} else {
				await this.handleCreateRepository();
			}
		} catch (error) {
			this.showError(error.message);
			this.updateContinueButtonState('default', this.t('repositorySelection.continue.button', '继续'));
			// 恢复选项卡按钮
			this.disableTabButtons(false);
		} finally {
			this.state.loading = false;
		}
	}

	/**
	 * 检查DIPCP.md文件是否存在
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<boolean>} 文件是否存在
	 */
	async checkDIPCPFile(owner, repo) {
		const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/DIPCP.md`;
		const response = await fetch(url);
		if (!response.ok) {
			return false;
		}
		return true;
	}

	/**
	 * 处理现有仓库
	 * @async
	 */
	async handleExistingRepository() {
		const repositoryUrl = this.state.formData.repositoryUrl;

		if (!repositoryUrl) {
			throw new Error(this.t('repositorySelection.errors.noUrl', '请输入仓库地址'));
		}

		// 解析仓库信息
		const repoInfo = this.parseGitHubUrl(repositoryUrl);
		if (!repoInfo) {
			throw new Error(this.t('repositorySelection.errors.invalidUrl', '无效的GitHub仓库URL'));
		}

		// 检查DIPCP.md文件是否存在
		const hasDIPCPFile = await this.checkDIPCPFile(repoInfo.owner, repoInfo.repo);
		if (!hasDIPCPFile) {
			throw new Error(this.t('repositorySelection.errors.noDIPCPFile', '该仓库根目录下没有DIPCP.md文件，不是一个有效的DIPCP项目'));
		}
		if (this.state.creationsList.length === 0) {
			await this.loadCreationsList();
		}

		const creation = this.state.creationsList.find(c => c.repository === `${repoInfo.owner}/${repoInfo.repo}`);

		// 通过openReadingPage来保存历史记录和跳转
		if (creation) {
			await this.openReadingPage(creation);
		} else {
			throw new Error(this.t('repositorySelection.errors.invalidUrl', '无效的GitHub仓库URL'));
		}
	}

	/**
	 * 处理创建仓库
	 * @async
	 */
	async handleCreateRepository() {
		const { name, penName, repo, description, language, category } = this.state.formData;

		// 验证输入数据
		this.validateInputData(category, name, penName, description, repo);

		// 先显示CLA，同意后才创建仓库
		// 构建临时的仓库信息对象用于CLA显示（此时仓库尚未创建）
		const repoInfo = {
			owner: window.app.user.username,
			name: name,
			penName: penName,
			description: description,
			repo: repo,
			language: language,
			category: category,
			repository: `${window.app.user.username}/${repo}`
		};

		this.updateContinueButtonState('loading', this.t('common.processing', '处理中...'));
		this.updateLoadingIndicator(this.t('common.processing', '处理中...'));

		await this.showCLAAgreement(repoInfo, async () => {
			// CLA签署成功后，现在才创建仓库
			await this.createRepository(repoInfo, true); // 根仓库
			// 创建一个Issue，用于投票
			await window.GitHubService.createIssue(window.app.user.username, repo, {
				title: `Voting`,
			});
			this.state.creationsList.push(repoInfo);
			window.app.user.pen_name = penName;
			await window.StorageService.saveKV('user', window.app.user);

			await this.openReadingPage(repoInfo);

		}, async () => {
			// 拒绝签名
			this.restoreCursorState();
			this.updateContinueButtonState('default', this.t('repositorySelection.continue.button', '继续'));
		});
	}

	/**
	 * 验证输入数据
	 * @param {string} category - 类别
	 * @param {string} name - 作品名称
	 * @param {string} penName - 笔名
	 * @param {string} description - 作品描述
	 * @param {string} repo - 仓库名称
	 * @throws {Error} 如果验证失败
	 */
	validateInputData(category, name, penName, description, repo) {
		// 检查是否只包含英文、数字、下划线和连字符
		const validRepoRegex = /^[a-zA-Z0-9_-]+$/;
		if (!validRepoRegex.test(repo)) {
			throw new Error(this.t('repositorySelection.errors.repoInvalid', '仓库名只能包含英文字母、数字、下划线和连字符'));
		}

		// 检查长度
		if (repo.trim().length === 0 || repo.length > 100) {
			throw new Error(this.t('repositorySelection.errors.repoTooLong', '仓库名不能为空，且长度不能超过100个字符'));
		}

		// 检查长度（中文等非ASCII字符按2个长度计算）
		const categoryLength = category ? category.replace(/[^\x00-\x7F]/g, 'xx').length : 0;
		const nameLength = name ? name.replace(/[^\x00-\x7F]/g, 'xx').length : 0;
		const penNameLength = penName ? penName.replace(/[^\x00-\x7F]/g, 'xx').length : 0;
		const descriptionLength = description ? description.replace(/[^\x00-\x7F]/g, 'xx').length : 0;
		if (descriptionLength == 0 || descriptionLength > 350) {
			throw new Error(this.t('repositorySelection.errors.descriptionInvalid', '作品描述不能为空，且长度不能超过350个字符'));
		}
		if (penNameLength == 0 || penNameLength > 100) {
			throw new Error(this.t('repositorySelection.errors.penNameInvalid', '笔名不能为空，且长度不能超过100个字符'));
		}
		if (categoryLength == 0 || categoryLength > 100) {
			throw new Error(this.t('repositorySelection.errors.categoryInvalid', '类别不能为空，且长度不能超过100个字符'));
		}
		if (nameLength == 0 || nameLength > 100) {
			throw new Error(this.t('repositorySelection.errors.nameInvalid', '作品名称不能为空，且长度不能超过100个字符'));
		}
	}

	/**
	 * 同步仓库story目录内容
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 */
	async syncRepositoryRoot(owner, repo) {
		let storyContents = [];
		try {
			// 获取 story 目录下的内容
			storyContents = await window.GitHubService.safeCall(async (octokit) => {
				const { data } = await octokit.rest.repos.getContent({
					owner,
					repo,
					path: 'story'
				});
				return Array.isArray(data) ? data : [];
			});
		} catch (error) {
			console.warn('无法通过API获取story目录内容:', error);
		}

		console.log(`🔵 开始同步 ${storyContents.length} 个story目录下的文件...`);

		// 递归获取 story 目录及其子目录下的所有 .md 文件
		const allFiles = [];
		const processDirectory = async (path) => {
			try {
				const contents = await window.GitHubService.safeCall(async (octokit) => {
					const { data } = await octokit.rest.repos.getContent({
						owner,
						repo,
						path: path
					});
					return Array.isArray(data) ? data : [];
				});

				for (const item of contents) {
					if (item.type === 'file' && item.name.endsWith('.md') && !item.name.startsWith('.')) {
						allFiles.push(item);
					} else if (item.type === 'dir' && !item.name.startsWith('.')) {
						// 递归处理子目录
						await processDirectory(item.path);
					}
				}
			} catch (error) {
				console.warn(`无法获取目录 ${path} 的内容:`, error);
			}
		};

		// 先处理 story 目录下的直接文件
		const directFiles = storyContents.filter(item =>
			item.type === 'file' &&
			!item.name.startsWith('.') &&
			item.name.endsWith('.md')
		);
		allFiles.push(...directFiles);

		// 处理 story 目录下的子目录
		const subDirs = storyContents.filter(item => item.type === 'dir' && !item.name.startsWith('.'));
		for (const subDir of subDirs) {
			await processDirectory(subDir.path);
		}

		console.log(`🔵 过滤后需要下载 ${allFiles.length} 个文件...`);

		// 批量下载文件（使用StorageService.downloadFiles，它会自动使用raw URL）
		// 将 GitHub API 返回的相对路径转换为标准路径格式：owner/repo/path
		if (allFiles.length > 0) {
			const standardPaths = allFiles.map(file => {
				// file.path 是 GitHub API 返回的相对路径（如 'story/index.md'）
				// 需要转换为标准路径格式：owner/repo/story/index.md
				return `${owner}/${repo}/${file.path}`;
			});
			await window.StorageService.downloadFiles(standardPaths);
		}
	}

	/**
	 * 打开阅读页面
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 */
	async openReadingPage(repoInfo) {
		try {
			let owner, repo, repository;
			// 从repository字段解析（格式：owner/repo）
			repository = repoInfo.repository;
			const parts = repository.split('/');
			if (parts.length === 2) {
				owner = parts[0];
				repo = parts[1];
			} else {
				throw new Error(`无效的repository格式: ${repository}`);
			}

			// 检查本地IndexedDB是否有数据
			let creation = await window.StorageService.getCreation(repository);
			const hasData = creation !== undefined && creation !== null;

			if (!hasData) {
				// 如果没有数据，找到作品信息
				creation = this.state.creationsList.find(c => c.repository === repository);
				creation.last_read = new Date().toISOString();
				await window.StorageService.updateCreation(creation);
				// 自动同步根目录下的全部内容
				const syncingText = this.t('repositorySelection.syncing', '正在同步文件...');
				this.updateContinueButtonState('loading', syncingText);
				this.updateLoadingIndicator(syncingText);
				await this.syncRepositoryRoot(owner, repo);
			}

			// 更新当前仓库信息
			window.app.setting.current_repo = repository;
			window.app.setting.current_article = `${repository}/story/index.md`;
			await window.StorageService.saveKV('setting', window.app.setting);

			// 如果自己是根作者，将作品添加到自己的作品列表中
			if (owner === window.app.user.username && !window.app.user.creations.includes(repository)) {
				window.app.user.creations.push(repository);
				await window.StorageService.saveKV('user', window.app.user);
			} else {
				// 判断是否是作者
				const isAuthor = await this.checkDIPCPFile(window.app.user.username, repo);
				if (isAuthor) {
					// 已经签署过CLA
					window.app.user.CLA = true;
					window.app.user.creations.push(repository);
					await window.StorageService.saveKV('user', window.app.user);
					//TODO: 递归下载作者仓库的全部md文件
				}
			}

			// 保存仓库信息到历史记录
			this.saveToHistory(repoInfo);

			// 跳转到阅读页面前，恢复光标状态
			this.restoreCursorState();

			if (window.app && window.app.navigateTo) {
				window.app.navigateTo('/view');
			}
		} catch (error) {
			const errorText = `${this.t('repositorySelection.syncFailed', '同步失败')}`;
			console.error(error);
			this.updateContinueButtonState('error', errorText);
			this.updateLoadingIndicator(errorText);
		}
	}

	/**
	 * 禁用或启用选项卡按钮和刷新按钮
	 * @param {boolean} disabled - 是否禁用
	 */
	disableTabButtons(disabled) {
		const tabButtons = this.element?.querySelectorAll('.tab-button');
		if (tabButtons) {
			tabButtons.forEach(btn => {
				if (disabled) {
					btn.disabled = true;
					btn.style.pointerEvents = 'none';
					btn.style.opacity = '0.6';
					btn.style.cursor = 'not-allowed';
				} else {
					btn.disabled = false;
					btn.style.pointerEvents = '';
					btn.style.opacity = '';
					btn.style.cursor = '';
				}
			});
		}

		// 同时禁用/启用刷新按钮
		const refreshBtn = this.element?.querySelector('#refresh-projects-btn');
		if (refreshBtn) {
			if (disabled) {
				refreshBtn.disabled = true;
				refreshBtn.style.pointerEvents = 'none';
				refreshBtn.style.opacity = '0.6';
				refreshBtn.style.cursor = 'not-allowed';
			} else {
				refreshBtn.disabled = false;
				refreshBtn.style.pointerEvents = '';
				refreshBtn.style.opacity = '';
				refreshBtn.style.cursor = '';
			}
		}
	}

	/**
	 * 恢复光标状态
	 */
	restoreCursorState() {
		const container = this.element?.closest('.dashboard') || this.element;
		if (container) {
			container.style.cursor = '';
		}
		// 同时恢复所有项目项的光标
		const allItems = this.element?.querySelectorAll('.history-item.clickable');
		if (allItems) {
			allItems.forEach(i => {
				i.style.cursor = '';
			});
		}
		// 恢复选项卡按钮
		this.disableTabButtons(false);
	}

	/**
	 * 更新加载指示器（项目栏中的加载状态）
	 * @param {string} message - 加载消息
	 */
	updateLoadingIndicator(message) {
		if (this.state.currentLoadingIndicator) {
			this.state.currentLoadingIndicator.textContent = '⏳ ' + message;
		}
	}

	/**
	 * 更新继续按钮状态
	 * @param {string} state - 按钮状态
	 * @param {string} message - 按钮消息
	 */
	updateContinueButtonState(state, message) {
		const continueBtn = this.element.querySelector('#continue-btn');
		if (!continueBtn) return;

		continueBtn.classList.remove('loading', 'success', 'error');

		if (state !== 'default') {
			continueBtn.classList.add(state);
		}

		switch (state) {
			case 'loading':
				continueBtn.disabled = true;
				continueBtn.innerHTML = `⏳ ${this.escapeHtml(message)}`;
				break;
			case 'success':
				continueBtn.disabled = true;
				continueBtn.innerHTML = `✅ ${this.escapeHtml(message)}`;
				break;
			case 'error':
				continueBtn.disabled = true;
				continueBtn.innerHTML = `❌ ${this.escapeHtml(message)}`;
				break;
			default:
				continueBtn.disabled = false;
				continueBtn.innerHTML = `<span class="btn-text">${this.t('repositorySelection.continue.button', '继续')}</span>`;
		}
	}

	/**
	 * 显示错误消息
	 * @param {string} message - 错误消息内容
	 */
	showError(message) {
		const errorDiv = document.createElement('div');
		errorDiv.className = 'error-message';
		errorDiv.textContent = message;
		errorDiv.style.cssText = 'color: red; margin-top: 10px; padding: 10px; background: #ffe6e6; border: 1px solid #ff9999; border-radius: 4px;';
		this.element.querySelector('.tab-content').appendChild(errorDiv);
		setTimeout(() => errorDiv.remove(), 5000);
	}

	/**
	 * 销毁组件
	 * 清理资源并移除DOM元素
	 */
	destroy() {
		// 清理资源
		if (this.element) {
			this.element.innerHTML = '';
		}
	}
}

// 注册组件
window.CreationsPage = CreationsPage;

