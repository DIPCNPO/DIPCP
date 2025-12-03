/**
 * 登录页面组件
 * 完全组件化的登录页面
 * @class
 * @extends {BasePage}
 */
class LoginPage extends BasePage {
	/**
	 * 构造函数
	 * @param {Object} props - 组件属性
	 */
	constructor(props = {}) {
		super(props);
		this.accessToken = '';
		this.loading = false;
	}

	/**
	 * 渲染页面主容器
	 * @returns {HTMLElement} 登录页面的容器元素
	 */
	render() {
		const container = document.createElement('div');
		container.className = 'login-container';
		container.innerHTML = `
			${this.renderLogo()}
			${this.renderFeatures()}
			${this.renderLoginForm()}
			${this.renderTips()}
		`;
		return container;
	}

	/**
	 * 渲染Logo部分
	 * @returns {string} Logo的HTML字符串
	 */
	renderLogo() {
		return `
            <div class="logo">
                <h1>DIPCP</h1>
                <p class="subtitle">${this.t('login.subtitle')}</p>
            </div>
        `;
	}

	/**
	 * 渲染特性说明部分
	 * @returns {string} 特性说明的HTML字符串
	 */
	renderFeatures() {
		return `
            <div class="features">
                <h3>${this.t('login.whyChoose')}</h3>
                <ul>
                    <li>${this.t('login.feature1')}</li>
                    <li>${this.t('login.feature2')}</li>
                    <li>${this.t('login.feature3')}</li>
                    <li>${this.t('login.feature4')}</li>
                    <li>${this.t('login.feature5')}</li>
                </ul>
            </div>
        `;
	}

	/**
	 * 渲染登录表单
	 * @returns {string} 登录表单的HTML字符串
	 */
	renderLoginForm() {
		return `
            <div class="login-form">
                ${this.renderLanguageSelector()}
                ${this.renderFormGroups()}
                ${this.renderLoginButton()}
            </div>
        `;
	}

	/**
	 * 渲染语言选择器
	 * @returns {string} 语言选择器的HTML字符串
	 */
	renderLanguageSelector() {
		const options = window.I18nService.supportedLanguages.map(lang => {
			const isSelected = window.app.setting.language === lang ? 'selected' : '';
			const displayName = window.I18nService.getLanguageDisplayName(lang);
			return `<option value="${this.escapeHtmlAttribute(lang)}" ${isSelected}>${this.escapeHtml(displayName)}</option>`;
		}).join('');

		return `
            <div class="form-group">
                <select id="language-select" aria-label="language-select">
                    ${options}
                </select>
            </div>
        `;
	}

	/**
	 * 渲染表单输入组
	 * @returns {string} 表单输入组的HTML字符串
	 */
	renderFormGroups() {
		return `
            <div class="form-group">
                <div class="form-hint" style="color: red; font-weight: bold; margin-top: 0.5rem; font-size: 0.9rem;">
                    ${this.t('login.hint.tokenLocalOnly')}
                </div>
                <div class="input-with-help">
                    <input type="password" id="access-token" 
                        placeholder="${this.tAttr('login.placeholders.accessToken')}" 
                        value="${this.escapeHtmlAttribute(this.accessToken)}" required>
                    <button type="button" class="help-button" id="token-help-btn">${this.t('login.howToGetToken')}</button>
                </div>
            </div>
        `;
	}

	/**
	 * 渲染登录按钮
	 * @returns {string} 登录按钮的HTML字符串
	 */
	renderLoginButton() {
		const loadingClass = this.loading ? 'loading' : '';
		const disabledAttr = this.loading ? 'disabled' : '';

		return `
            <div class="login-button-container">
                <button id="login-btn" class="btn btn-primary ${loadingClass}" ${disabledAttr}>
                    <span class="btn-text">${this.loading ? this.t('login.loggingIn', '登录中...') : this.t('login.loginButton', '登录')}</span>
                    <span class="btn-loading" style="display: none;">${this.t('login.loggingIn', '登录中...')}</span>
                </button>
            </div>
        `;
	}

	/**
	 * 渲染提示信息
	 * @returns {string} 提示信息的HTML字符串
	 */
	renderTips() {
		return `
            <div class="tips">
                <p>${this.t('login.terms')} <a href="#" id="terms-link">${this.t('login.termsLink')}</a> ${this.t('login.and')} <a href="#" id="privacy-link">${this.t('login.privacyLink')}</a></p>
            </div>
        `;
	}

	/**
	 * 挂载组件到DOM
	 * @param {HTMLElement} element - 挂载的容器元素
	 */
	mount(element) {
		this.element = element;
		this.element.innerHTML = '';
		this.element.appendChild(this.render());
		this.bindEvents();

		// 为 #app 添加类名，用于应用登录页面特定的样式
		const appContainer = document.getElementById('app');
		if (appContainer) {
			appContainer.classList.add('has-login-page');
		}
	}

	/**
	 * 绑定事件监听器
	 */
	bindEvents() {
		// 语言选择
		const languageSelect = this.element.querySelector('#language-select');
		if (languageSelect) {
			languageSelect.addEventListener('change', async (e) => {
				const newLanguage = e.target.value;
				console.log('LoginPage: 语言切换为', newLanguage);
				await this.setLanguage(newLanguage);
			});
		}

		// 登录按钮
		const loginBtn = this.element.querySelector('#login-btn');
		if (loginBtn) {
			loginBtn.addEventListener('click', () => {
				this.handleLogin();
			});
		}

		// Token帮助按钮
		const tokenHelpBtn = this.element.querySelector('#token-help-btn');
		if (tokenHelpBtn) {
			tokenHelpBtn.addEventListener('click', () => {
				this.showTokenHelp();
			});
		}

		// 服务条款和隐私政策链接
		const termsLink = this.element.querySelector('#terms-link');
		if (termsLink) {
			termsLink.addEventListener('click', (e) => {
				e.preventDefault();
				if (window.app && window.app.navigateTo) {
					window.app.navigateTo('/terms');
				}
			});
		}

		const privacyLink = this.element.querySelector('#privacy-link');
		if (privacyLink) {
			privacyLink.addEventListener('click', (e) => {
				e.preventDefault();
				if (window.app && window.app.navigateTo) {
					window.app.navigateTo('/privacy');
				}
			});
		}

		// 表单输入
		const inputs = this.element.querySelectorAll('input');
		inputs.forEach(input => {
			input.addEventListener('input', (e) => {
				let fieldName = e.target.id.replace('github-', '');
				// 处理access-token字段
				if (e.target.id === 'access-token') {
					fieldName = 'accessToken';
				}
				this.accessToken = e.target.value;
			});
		});
	}

	/**
	 * 处理登录操作
	 * @async
	 */
	async handleLogin() {
		if (this.loading) return;

		try {
			this.loading = true;
			// 立即禁用按钮
			this.updateLoginButtonState('loading', this.t('login.loggingIn', '登录中...'));
			// 获取当前表单值
			const accessToken = this.element.querySelector('#access-token');
			if (accessToken) this.accessToken = accessToken.value;
			// 执行登录流程
			await this.performLogin();
		} catch (error) {
			this.showError(error.message);
			// 登录失败时恢复按钮状态
			this.updateLoginButtonState('default', this.t('login.loginButton', '登录'));
		} finally {
			this.loading = false;
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
		this.element.querySelector('.login-form').appendChild(errorDiv);
		setTimeout(() => errorDiv.remove(), 5000);
	}

	/**
	 * 显示Token获取帮助信息
	 */
	showTokenHelp() {
		const modal = new window.Modal();
		// 使用 showInfo 方法，这是 Modal 提供的标准方法
		modal.showInfo(
			this.t('login.howToGetToken'),
			this.t('login.registerHelpContent', '', true),
			{ showCancel: false }
		);
	}

	/**
	 * 设置语言并重新渲染页面
	 * @async
	 * @param {string} language - 语言代码（如 'zh-CN', 'en-US', 'ja-JP'）
	 */
	async setLanguage(language) {
		// 更新本地状态
		window.app.setting.language = language;

		// 通知 i18n 服务切换语言
		await window.I18nService.changeLanguage(language);

		// 重新挂载页面以更新文本
		if (this.element) {
			// 保存当前表单值
			const accessToken = this.element.querySelector('#access-token');
			if (accessToken) this.accessToken = accessToken.value;

			// 清空容器并重新挂载
			this.element.innerHTML = '';
			this.element.appendChild(this.render());

			// 恢复表单值
			if (this.accessToken) {
				accessToken.value = this.accessToken;
			}

			// 重新绑定事件
			this.bindEvents();
		}
	}

	/**
	 * 执行登录流程
	 * @async
	 */
	async performLogin() {
		// 验证必填字段
		if (!this.accessToken) {
			throw new Error(this.t('login.validation.formInvalid', '请填写所有必填字段'));
		}

		// 验证GitHub Access Token
		console.log('验证GitHub Access Token...');

		// 使用GitHubService验证用户
		try {
			// 先初始化GitHubService
			await window.GitHubService.init(this.accessToken);

			// 获取认证用户信息
			const data = await window.GitHubService.getAuthenticatedUser();

			const userInfo = {
				username: data.login,
				pen_name: '',
				token: this.accessToken,
				email: data.email,
				CLA: false,
				creations: [],
			};
			window.app.user = userInfo;
			await window.StorageService.saveKV('user', userInfo);

			// 获取API速率限制额度
			const rateLimit = await window.GitHubService.checkRateLimit();
			if (rateLimit && rateLimit.limit < 100) {
				console.log('API限额过低，设置同步间隔为10分钟');
				window.app.setting.sync_interval = 10;
				await window.StorageService.saveKV('setting', window.app.setting);
			}
		} catch (error) {
			// 检查是否是 token 格式错误（包含非 ISO-8859-1 字符）
			if (error.message && (
				error.message.includes("Failed to read the 'headers' property") ||
				error.message.includes('non ISO-8859-1') ||
				error.message.includes('String contains non ISO-8859-1')
			)) {
				throw new Error(this.t('login.validation.invalidTokenFormat', 'Token格式错误：Token中不能包含非ASCII字符（如中文等）。请确保Token只包含字母、数字和标准符号。'));
			}

			// 检查是否是 401 未授权错误
			if (error.status === 401) {
				throw new Error(this.t('login.validation.invalidToken', 'Token无效或已过期，请检查您的Token是否正确'));
			}

			// 其他错误直接抛出
			throw error;
		}

		// 直接跳转到创作列表页面
		if (window.app && window.app.navigateTo) {
			window.app.navigateTo('/creations');
		}
	}

	/**
	 * 更新登录按钮状态
	 * @param {string} state - 按钮状态（'loading', 'default'等）
	 * @param {string} message - 按钮显示的消息
	 * @returns {void}
	 */
	updateLoginButtonState(state, message) {
		const loginBtn = this.element.querySelector('#login-btn');
		if (!loginBtn) return;

		// 移除之前的状态类
		loginBtn.classList.remove('loading', 'success', 'error');

		// 添加新的状态类
		if (state !== 'default') {
			loginBtn.classList.add(state);
		}

		// 更新按钮文本和状态
		switch (state) {
			case 'loading':
				loginBtn.disabled = true;
				loginBtn.innerHTML = `⏳ ${message}`;
				break;
			case 'success':
				loginBtn.disabled = true;
				loginBtn.innerHTML = `✅ ${message}`;
				break;
			case 'error':
				loginBtn.disabled = true;
				loginBtn.innerHTML = `❌ ${message}`;
				break;
			default:
				loginBtn.disabled = false;
				loginBtn.innerHTML = `<span class="btn-text">${this.t('login.loginButton', '登录')}</span>`;
		}
	}

	/**
	 * 销毁组件
	 * 清理资源并移除DOM元素
	 */
	destroy() {
		// 移除登录页面特定的类名
		const appContainer = document.getElementById('app');
		if (appContainer) {
			appContainer.classList.remove('has-login-page');
		}

		// 清理资源
		if (this.element) {
			this.element.innerHTML = '';
		}
	}
}

// 注册组件
window.LoginPage = LoginPage;
