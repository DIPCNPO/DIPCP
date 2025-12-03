// 多语言服务
window.I18nService = {
	currentLanguage: 'en-US',
	fallbackLanguage: 'en-US',
	translations: {},
	supportedLanguages: ['zh-CN', 'en-US', 'ja-JP'],
	defaultLanguage: 'en-US',

	/**
	 * 获取语言显示名称
	 * @param {string} languageCode - 语言代码
	 * @returns {string} 语言显示名称
	 */
	getLanguageDisplayName(languageCode) {
		const displayNames = {
			'zh-CN': '中文',
			'en-US': 'English',
			'ja-JP': '日本語'
		};
		return displayNames[languageCode] || languageCode;
	},

	/**
	 * 初始化多语言服务
	 */
	async init() {
		try {
			// 获取用户设置的语言
			const savedLanguage = window?.app?.setting?.language;
			if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
				this.currentLanguage = savedLanguage;
			} else {
				// 检测浏览器语言
				this.currentLanguage = this.detectBrowserLanguage();
			}

			// 加载当前语言的翻译文件
			await this.loadTranslations(this.currentLanguage);

		} catch (error) {
			console.error('Failed to initialize i18n service:', error);
			// 回退到默认语言
			this.currentLanguage = this.defaultLanguage;
			await this.loadTranslations(this.defaultLanguage);
		}
	},

	/**
	 * 检测浏览器语言
	 */
	detectBrowserLanguage() {
		const browserLang = navigator.language || navigator.userLanguage;

		// 检查是否支持完整的语言代码
		if (this.supportedLanguages.includes(browserLang)) {
			return browserLang;
		}

		// 检查是否支持语言前缀（如 en-US -> en）
		const langPrefix = browserLang.split('-')[0];
		for (const supportedLang of this.supportedLanguages) {
			if (supportedLang.startsWith(langPrefix)) {
				return supportedLang;
			}
		}

		// 默认返回英语
		return 'en-US';
	},

	/**
	 * 加载翻译文件
	 */
	async loadTranslations(language) {
		try {
			const response = await fetch(`locales/${language}.json`);
			if (!response.ok) {
				throw new Error(`Failed to load translations for ${language}`);
			}
			this.translations = await response.json();
			this.currentLanguage = language;

			// 保存用户语言选择
			if (window?.app?.setting) {
				window.app.setting.language = language;
				await window.StorageService.saveKV('setting', window.app.setting);
			}

			// 自动翻译页面（延迟执行确保DOM已准备好）
			setTimeout(() => {
				this.translatePage();
			}, 100);
		} catch (error) {
			// 如果加载失败，尝试加载默认语言
			if (language !== this.defaultLanguage) {
				await this.loadTranslations(this.defaultLanguage);
			} else {
				throw error;
			}
		}
	},

	/**
	 * 获取翻译文本
	 * @param {string} key - 翻译键，支持点号分隔的嵌套键
	 * @param {object} params - 参数对象，用于替换占位符
	 * @returns {string} 翻译后的文本
	 */
	t(key, params = {}) {
		try {
			// 支持点号分隔的嵌套键，如 'login.title'
			const keys = key.split('.');
			let value = this.translations;

			for (const k of keys) {
				if (value && typeof value === 'object' && k in value) {
					value = value[k];
				} else {
					// 如果找不到翻译，返回键本身
					console.warn(`Translation key not found: ${key}`);
					return key;
				}
			}

			if (typeof value !== 'string') {
				console.warn(`Translation value is not a string: ${key}`);
				return key;
			}

			// 替换参数占位符 {{param}}
			return this.replaceParams(value, params);
		} catch (error) {
			console.error(`Error getting translation for key ${key}:`, error);
			return key;
		}
	},

	/**
	 * 替换参数占位符
	 * @param {string} text - 包含占位符的文本
	 * @param {object} params - 参数对象
	 * @returns {string} 替换后的文本
	 */
	replaceParams(text, params) {
		return text.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
			return params[paramName] !== undefined ? params[paramName] : match;
		});
	},

	/**
	 * 切换语言
	 * @param {string} language - 目标语言代码
	 */
	async changeLanguage(language) {
		if (!this.supportedLanguages.includes(language)) {
			console.warn(`Unsupported language: ${language}`);
			return false;
		}

		try {
			await this.loadTranslations(language);

			// 触发语言切换事件
			this.dispatchLanguageChangeEvent();

			console.log(`Language changed to: ${language}`);
			return true;
		} catch (error) {
			console.error(`Failed to change language to ${language}:`, error);
			return false;
		}
	},

	/**
	 * 触发语言切换事件
	 */
	dispatchLanguageChangeEvent() {
		const event = new CustomEvent('languageChanged', {
			detail: {
				language: this.currentLanguage,
				translations: this.translations
			}
		});
		document.dispatchEvent(event);
	},

	/**
	 * 获取当前语言
	 * @returns {string} 当前语言代码
	 */
	getCurrentLanguage() {
		return this.currentLanguage;
	},

	/**
	 * 获取支持的语言列表
	 * @returns {array} 支持的语言代码数组
	 */
	getSupportedLanguages() {
		return [...this.supportedLanguages];
	},

	/**
	 * 批量翻译页面元素
	 * @param {string} selector - CSS选择器，默认为所有带有data-i18n属性的元素
	 */
	translatePage(selector = '[data-i18n]') {
		const elements = document.querySelectorAll(selector);
		elements.forEach(element => {
			const key = element.getAttribute('data-i18n');
			if (key) {
				const params = this.getElementParams(element);
				const translatedText = this.t(key, params);
				this.updateElementText(element, translatedText);
			}
		});
	},

	/**
	 * 获取元素的参数
	 * @param {Element} element - DOM元素
	 * @returns {object} 参数对象
	 */
	getElementParams(element) {
		const params = {};
		const paramAttributes = element.querySelectorAll('[data-i18n-param]');
		paramAttributes.forEach(paramElement => {
			const paramName = paramElement.getAttribute('data-i18n-param');
			const paramValue = paramElement.textContent || paramElement.value;
			if (paramName && paramValue) {
				params[paramName] = paramValue;
			}
		});
		return params;
	},

	/**
	 * 更新元素文本
	 * @param {Element} element - DOM元素
	 * @param {string} text - 翻译后的文本
	 */
	updateElementText(element, text) {
		if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
			if (element.type === 'submit' || element.type === 'button') {
				element.value = text;
			} else {
				element.placeholder = text;
			}
		} else {
			element.textContent = text;
		}
	},

	/**
	 * 格式化日期
	 * @param {Date} date - 日期对象
	 * @param {string} format - 格式类型
	 * @returns {string} 格式化后的日期字符串
	 */
	formatDate(date, format = 'default') {
		const dateObj = new Date(date);
		const options = {
			'zh-CN': {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			},
			'en-US': {
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				hour12: true
			}
		};

		return dateObj.toLocaleString(this.currentLanguage, options[this.currentLanguage] || options['zh-CN']);
	},

	/**
	 * 格式化数字
	 * @param {number} number - 数字
	 * @returns {string} 格式化后的数字字符串
	 */
	formatNumber(number) {
		return new Intl.NumberFormat(this.currentLanguage).format(number);
	}
};

