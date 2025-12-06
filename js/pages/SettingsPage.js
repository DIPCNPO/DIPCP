/**
 * 设置页面组件
 * 完全组件化的设置页面，提供语言、主题、账户等设置功能
 * @class SettingsPage
 * @extends {BasePage}
 */
class SettingsPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
	}

	/**
	 * 渲染组件
	 * @returns {HTMLElement} 渲染后的DOM元素
	 */
	async render() {
		const container = document.createElement('div');
		container.className = 'dashboard';

		container.innerHTML = `
			${this.renderHeader()}
			<main class="project-detail-main">
				<div class="settings-content">
					${this.renderSettings()}
				</div>
			</main>
		`;
		return container;
	}

	/**
	 * 渲染设置项
	 * @returns {string} 设置HTML字符串
	 */
	renderSettings() {
		const setting = window.app.setting;
		const currentRepo = window.app.setting.current_repo;
		const currentLanguage = window.app.setting.language;
		const supportedLanguages = window.I18nService.getSupportedLanguages();

		return `
			<div class="settings-container">
				<h2 class="settings-title">${this.t('settingsPage.title', '设置')}</h2>
				${!setting.DIPCP_star ? `
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.starDIPCP', '给DIPCP项目加星')}</span>
						</div>
						<div class="settings-item-control">
							<button class="btn btn-primary" id="star-dipcp">
								${this.t('settingsPage.star', '加星')}
							</button>
						</div>
					</div>
				</div>
				` : ''}
				${!setting.creation_star.includes(currentRepo) ? `
				<div class="settings-section">
						<div class="settings-item">
							<div class="settings-item-label">
								<span>${this.t('settingsPage.starCreation', '给当前作品加星')}</span>
							</div>
							<div class="settings-item-control">
								<button class="btn btn-primary" id="star-creation">
									${this.t('settingsPage.star', '加星')}
								</button>
							</div>
						</div>
				</div>
				` : ''}
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.theme', '主题')}</span>
						</div>
						<div class="settings-item-control">
							<select id="theme-select" class="settings-select">
								<option value="dark" ${setting.dark_mode ? 'selected' : ''}>${this.t('theme.dark', '暗黑')}</option>
								<option value="light" ${!setting.dark_mode ? 'selected' : ''}>${this.t('theme.light', '明亮')}</option>
							</select>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.language', '界面语言')}</span>
						</div>
						<div class="settings-item-control">
							<select id="language-select" class="settings-select">
								${supportedLanguages.map(lang => `
									<option value="${lang}" ${lang === currentLanguage ? 'selected' : ''}>
										${window.I18nService.getLanguageDisplayName(lang)}
									</option>
								`).join('')}
							</select>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.fontSize', '字体大小')}</span>
							<span class="settings-value">${setting.font_size || 16}px</span>
						</div>
						<div class="settings-item-control">
							<input type="range" id="font-size-range" class="settings-range" 
								min="12" max="24" value="${setting.font_size || 16}" step="1">
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.syncInterval', '同步时间')}</span>
							<span class="settings-value">${setting.sync_interval || 5} ${this.t('settingsPage.minutes', '分钟')}</span>
						</div>
						<div class="settings-item-control">
							<input type="range" id="sync-interval-range" class="settings-range" 
								min="1" max="10" value="${setting.sync_interval || 5}" step="1">
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.alwaysRefresh', '总是从github获取最新文章')}</span>
						</div>
						<div class="settings-item-control">
							<label class="settings-switch">
								<input type="checkbox" id="always-refresh-checkbox" ${setting.always_refresh ? 'checked' : ''}>
								<span class="settings-slider"></span>
							</label>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.showMessage', '显示留言')}</span>
						</div>
						<div class="settings-item-control">
							<label class="settings-switch">
								<input type="checkbox" id="show-message-checkbox" ${setting.show_message !== false ? 'checked' : ''}>
								<span class="settings-slider"></span>
							</label>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.enableThirdPartyAI', '启用第三方AI翻译')}</span>
						</div>
						<div class="settings-item-control">
							<label class="settings-switch">
								<input type="checkbox" id="third-party-checkbox" ${setting.third_party ? 'checked' : ''}>
								<span class="settings-slider"></span>
							</label>
						</div>
					</div>
					<div id="third-party-config" style="display: ${setting.third_party ? 'block' : 'none'};">
						<div class="settings-item">
							<div class="settings-item-label">
								<span>${this.t('settingsPage.aiProviders', 'AI提供商')}</span>
							</div>
							<div class="settings-item-control">
								<div id="ai-providers-list">
									${this.renderAIProviders()}
								</div>
								<button class="btn btn-secondary" id="add-ai-provider">
									${this.t('settingsPage.addProvider', '添加提供商')}
								</button>
							</div>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<div class="settings-item">
						<div class="settings-item-label">
							<span>${this.t('settingsPage.username', '用户名')}</span>
						</div>
						<div class="settings-item-value">
							${this.escapeHtml(window.app.user.username || window.app.user.name || '')}
						</div>
					</div>
					<div class="settings-item">
						<div class="settings-item-control">
							<button class="btn btn-danger" id="logout-btn">
								${this.t('settingsPage.logout', '退出登录')}
							</button>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * 渲染AI提供商列表
	 * @returns {string} AI提供商HTML字符串
	 */
	renderAIProviders() {
		const thirdParties = window.app.setting.third_parties || [];
		if (thirdParties.length === 0) {
			return '<div class="settings-empty">' + this.t('settingsPage.noProviders', '暂无提供商') + '</div>';
		}

		return thirdParties.map((provider, index) => `
			<div class="ai-provider-item" data-index="${index}">
				<div class="ai-provider-info">
					<select class="ai-provider-select" data-index="${index}">
						<option value="openai" ${provider.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
						<option value="deepseek" ${provider.provider === 'deepseek' ? 'selected' : ''}>Deepseek</option>
						<option value="gemini" ${provider.provider === 'gemini' ? 'selected' : ''}>Gemini</option>
					</select>
					<input type="text" class="ai-provider-apikey" data-index="${index}" 
						placeholder="${this.tAttr('settingsPage.apiKeyPlaceholder', '请输入API Key')}"
						value="${this.escapeHtmlAttribute(provider.APIKEY || '')}">
				</div>
				<button class="btn btn-sm btn-danger ai-provider-delete" data-index="${index}">
					${this.t('settingsPage.delete', '删除')}
				</button>
			</div>
		`).join('');
	}

	/**
	 * 挂载组件到容器
	 * @param {HTMLElement} container - 容器元素
	 * @param {any} path - 路径参数（可选）
	 */
	async mount(container, path = null) {
		await super.mount(container, path);
		this.bindEvents();

		// 应用字体大小
		this.applyFontSize();
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		if (!this.element) return;

		// 给DIPCP项目加星
		const starDIPCPBtn = this.element.querySelector('#star-dipcp');
		if (starDIPCPBtn) {
			starDIPCPBtn.addEventListener('click', () => this.handleStarDIPCP());
		}

		// 给当前作品根仓库加星
		const starCreationBtn = this.element.querySelector('#star-creation');
		if (starCreationBtn) {
			starCreationBtn.addEventListener('click', () => this.handleStarCreation());
		}

		// 主题切换
		const themeSelect = this.element.querySelector('#theme-select');
		if (themeSelect) {
			themeSelect.addEventListener('change', (e) => this.handleThemeChange(e.target.value));
		}

		// 语言切换
		const languageSelect = this.element.querySelector('#language-select');
		if (languageSelect) {
			languageSelect.addEventListener('change', (e) => this.handleLanguageChange(e.target.value));
		}

		// 字体大小调整
		const fontSizeRange = this.element.querySelector('#font-size-range');
		if (fontSizeRange) {
			fontSizeRange.addEventListener('input', (e) => {
				const value = parseInt(e.target.value);
				const valueSpan = e.target.parentElement.previousElementSibling.querySelector('.settings-value');
				if (valueSpan) {
					valueSpan.textContent = `${value}px`;
				}
			});
			fontSizeRange.addEventListener('change', (e) => {
				this.handleFontSizeChange(parseInt(e.target.value));
			});
		}

		// 同步时间调整
		const syncIntervalRange = this.element.querySelector('#sync-interval-range');
		if (syncIntervalRange) {
			syncIntervalRange.addEventListener('input', (e) => {
				const value = parseInt(e.target.value);
				const valueSpan = e.target.parentElement.previousElementSibling.querySelector('.settings-value');
				if (valueSpan) {
					valueSpan.textContent = `${value} ${this.t('settingsPage.minutes', '分钟')}`;
				}
			});
			syncIntervalRange.addEventListener('change', (e) => {
				this.handleSyncIntervalChange(parseInt(e.target.value));
			});
		}

		// 总是刷新开关
		const alwaysRefreshCheckbox = this.element.querySelector('#always-refresh-checkbox');
		if (alwaysRefreshCheckbox) {
			alwaysRefreshCheckbox.addEventListener('change', (e) => {
				this.handleAlwaysRefreshChange(e.target.checked);
			});
		}

		// 显示留言开关
		const showMessageCheckbox = this.element.querySelector('#show-message-checkbox');
		if (showMessageCheckbox) {
			showMessageCheckbox.addEventListener('change', (e) => {
				this.handleShowMessageChange(e.target.checked);
			});
		}

		// 第三方AI开关
		const thirdPartyCheckbox = this.element.querySelector('#third-party-checkbox');
		if (thirdPartyCheckbox) {
			thirdPartyCheckbox.addEventListener('change', (e) => {
				this.handleThirdPartyChange(e.target.checked);
			});
		}

		// 添加AI提供商
		const addAIProviderBtn = this.element.querySelector('#add-ai-provider');
		if (addAIProviderBtn) {
			addAIProviderBtn.addEventListener('click', () => this.handleAddAIProvider());
		}

		// AI提供商删除按钮
		const deleteButtons = this.element.querySelectorAll('.ai-provider-delete');
		deleteButtons.forEach(btn => {
			btn.addEventListener('click', (e) => {
				const index = parseInt(e.target.dataset.index);
				this.handleDeleteAIProvider(index);
			});
		});

		// AI提供商选择变化
		const providerSelects = this.element.querySelectorAll('.ai-provider-select');
		providerSelects.forEach(select => {
			select.addEventListener('change', (e) => {
				const index = parseInt(e.target.dataset.index);
				this.handleAIProviderChange(index, e.target.value);
			});
		});

		// AI提供商API Key变化
		const apiKeyInputs = this.element.querySelectorAll('.ai-provider-apikey');
		apiKeyInputs.forEach(input => {
			input.addEventListener('change', (e) => {
				const index = parseInt(e.target.dataset.index);
				this.handleAIProviderAPIKeyChange(index, e.target.value);
			});
		});

		// 退出登录
		const logoutBtn = this.element.querySelector('#logout-btn');
		if (logoutBtn) {
			logoutBtn.addEventListener('click', () => this.handleLogout());
		}
	}

	/**
	 * 处理给DIPCP项目加星
	 * @returns {Promise<void>}
	 */
	async handleStarDIPCP() {
		try {
			if (window.app.setting.DIPCP_star) {
				return;
			}

			await window.GitHubService.starRepo('DIPCNPO', 'DIPCP');
			window.app.setting.DIPCP_star = true;
			await window.StorageService.saveKV('setting', window.app.setting);

			this.updateDOM();
		} catch (error) {
			console.error('加星失败:', error);
		}
	}

	/**
	 * 处理给当前作品根仓库加星
	 * @returns {Promise<void>}
	 */
	async handleStarCreation() {
		try {
			const currentRepo = window.app.setting.current_repo;

			if (window.app.setting.creation_star && window.app.setting.creation_star.includes(currentRepo)) {
				return;
			}

			const parsed = currentRepo.split('/');
			if (parsed.length !== 2) {
				return;
			}

			const [owner, repo] = parsed;
			await window.GitHubService.starRepo(owner, repo);

			window.app.setting.creation_star.push(currentRepo);
			await window.StorageService.saveKV('setting', window.app.setting);

			this.updateDOM();
		} catch (error) {
			console.error('加星失败:', error);
		}
	}

	/**
	 * 处理主题切换
	 * @param {string} theme - 主题 ('light' 或 'dark')
	 */
	async handleThemeChange(theme) {
		try {
			window.ThemeService.setTheme(theme);
			await window.StorageService.saveKV('setting', window.app.setting);
			// 重新渲染页面以应用新主题
			this.updateDOM();
		} catch (error) {
			console.error('主题切换失败:', error);
		}
	}

	/**
	 * 处理语言切换
	 * @param {string} language - 语言代码
	 */
	async handleLanguageChange(language) {
		try {
			await window.I18nService.changeLanguage(language);
			await window.StorageService.saveKV('setting', window.app.setting);
			// 重新渲染页面以应用新语言
			this.updateDOM();
		} catch (error) {
			console.error('语言切换失败:', error);
		}
	}

	/**
	 * 处理字体大小变化
	 * @param {number} fontSize - 字体大小
	 */
	async handleFontSizeChange(fontSize) {
		try {
			window.app.setting.font_size = fontSize;
			await window.StorageService.saveKV('setting', window.app.setting);
			this.applyFontSize();
		} catch (error) {
			console.error('字体大小设置失败:', error);
		}
	}

	/**
	 * 应用字体大小
	 */
	applyFontSize() {
		const fontSize = window.app.setting.font_size || 16;
		// 直接设置 html 元素的 font-size，这样所有使用 rem 单位的元素都会自动缩放
		document.documentElement.style.fontSize = `${fontSize}px`;
		// 同时更新 CSS 变量，以便其他地方使用
		document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
		document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
	}

	/**
	 * 处理同步时间变化
	 * @param {number} interval - 同步间隔（分钟）
	 */
	async handleSyncIntervalChange(interval) {
		try {
			window.app.setting.sync_interval = interval;
			await window.StorageService.saveKV('setting', window.app.setting);
			// 重启同步定时器（如果需要）
			window.app._scheduleNextCheck();
		} catch (error) {
			console.error('同步时间设置失败:', error);
		}
	}

	/**
	 * 处理总是刷新变化
	 * @param {boolean} alwaysRefresh - 是否总是刷新
	 */
	async handleAlwaysRefreshChange(alwaysRefresh) {
		try {
			window.app.setting.always_refresh = alwaysRefresh;
			await window.StorageService.saveKV('setting', window.app.setting);
		} catch (error) {
			console.error('总是刷新设置失败:', error);
		}
	}

	/**
	 * 处理显示留言变化
	 * @param {boolean} showMessage - 是否显示留言
	 */
	async handleShowMessageChange(showMessage) {
		try {
			window.app.setting.show_message = showMessage;
			await window.StorageService.saveKV('setting', window.app.setting);
		} catch (error) {
			console.error('显示留言设置失败:', error);
		}
	}

	/**
	 * 处理第三方AI变化
	 * @param {boolean} enabled - 是否启用
	 */
	async handleThirdPartyChange(enabled) {
		try {
			window.app.setting.third_party = enabled;
			await window.StorageService.saveKV('setting', window.app.setting);

			// 显示/隐藏AI提供商配置
			const configDiv = this.element.querySelector('#third-party-config');
			if (configDiv) {
				configDiv.style.display = enabled ? 'block' : 'none';
			}
		} catch (error) {
			console.error('第三方AI设置失败:', error);
		}
	}

	/**
	 * 处理添加AI提供商
	 */
	async handleAddAIProvider() {
		try {
			if (!window.app.setting.third_parties) {
				window.app.setting.third_parties = [];
			}

			window.app.setting.third_parties.push({
				provider: 'openai',
				APIKEY: ''
			});

			await window.StorageService.saveKV('setting', window.app.setting);
			this.updateDOM();
		} catch (error) {
			console.error('添加AI提供商失败:', error);
		}
	}

	/**
	 * 处理删除AI提供商
	 * @param {number} index - 提供商索引
	 */
	async handleDeleteAIProvider(index) {
		try {
			if (!window.app.setting.third_parties || index < 0 || index >= window.app.setting.third_parties.length) {
				return;
			}

			window.app.setting.third_parties.splice(index, 1);
			await window.StorageService.saveKV('setting', window.app.setting);
			this.updateDOM();
		} catch (error) {
			console.error('删除AI提供商失败:', error);
		}
	}

	/**
	 * 处理AI提供商变化
	 * @param {number} index - 提供商索引
	 * @param {string} provider - 提供商名称
	 */
	async handleAIProviderChange(index, provider) {
		try {
			if (!window.app.setting.third_parties || index < 0 || index >= window.app.setting.third_parties.length) {
				return;
			}

			window.app.setting.third_parties[index].provider = provider;
			await window.StorageService.saveKV('setting', window.app.setting);
		} catch (error) {
			console.error('AI提供商更新失败:', error);
		}
	}

	/**
	 * 处理AI提供商API Key变化
	 * @param {number} index - 提供商索引
	 * @param {string} apiKey - API Key
	 */
	async handleAIProviderAPIKeyChange(index, apiKey) {
		try {
			if (!window.app.setting.third_parties || index < 0 || index >= window.app.setting.third_parties.length) {
				return;
			}

			window.app.setting.third_parties[index].APIKEY = apiKey;
			await window.StorageService.saveKV('setting', window.app.setting);
		} catch (error) {
			console.error('API Key更新失败:', error);
		}
	}

	/**
	 * 处理退出登录
	 */
	async handleLogout() {
		try {
			console.log('开始退出登录');
			const modal = new window.Modal();
			modal.showConfirm(
				this.t('settingsPage.confirmLogout', '确认退出'),
				this.t('settingsPage.logoutMessage', '退出后将清除所有本地数据，确定要退出吗？'),
				async (confirmed) => {
					if (confirmed) {
						// 清除所有数据
						await window.StorageService.clear();
						console.log('清除所有数据');

						// 清除应用状态
						window.app.user = null;
						const language = window.app.setting.language;
						const dark_mode = window.app.setting.dark_mode;
						const font_size = window.app.setting.font_size;

						// 重新初始化setting为默认值（因为StorageService.delete()会删除所有数据）
						window.app.setting = {
							DIPCP_star: false,
							creation_star: [],
							dark_mode: dark_mode,
							language: language,
							font_size: font_size,
							sync_interval: 5,
							last_update: null,
							always_refresh: false,
							show_message: true,
							third_party: false,
							third_parties: [],
							recent_creations: [],
							read_path: [],
							read_path_index: -1,
							cursor_position: 0,
							current_page: '',
							current_article: '',
							current_repo: '',
						};
						await window.StorageService.saveKV('setting', window.app.setting);
						console.log('重新初始化setting为默认值');

						// 返回登录页（使用根路径，因为路由表中登录页是'/'）
						await window.app.navigateTo('/');
					}
				}
			);
		} catch (error) {
			console.error('退出登录失败:', error);
		}
	}

	/**
	 * 更新DOM
	 */
	updateDOM() {
		if (!this.element) return;

		const settingsContent = this.element.querySelector('.settings-content');
		if (settingsContent) {
			settingsContent.innerHTML = this.renderSettings();
		}

		// 重新绑定事件
		this.bindEvents();

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}

		// 应用字体大小
		this.applyFontSize();
	}
}

// 注册组件
window.SettingsPage = SettingsPage;
