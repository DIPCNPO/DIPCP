/**
 * 主题服务
 * 支持暗黑和明亮两种主题切换
 */
window.ThemeService = {
	currentTheme: 'dark', // 'light', 'dark' - 默认暗黑主题

	/**
	 * 初始化主题管理器
	 */
	init() {
		// 从本地存储读取用户设置
		this.currentTheme = window.app.setting.dark_mode ? 'dark' : 'light';
		// 应用主题
		this.applyTheme();
	},

	/**
	 * 获取当前主题
	 */
	getCurrentTheme() {
		return this.currentTheme;
	},

	/**
	 * 设置主题
	 */
	setTheme(theme) {
		if (!['light', 'dark'].includes(theme)) {
			console.warn('Invalid theme:', theme);
			return;
		}

		this.currentTheme = theme;
		window.app.setting.dark_mode = this.currentTheme === 'dark'

		window.StorageService.saveKV('setting', window.app.setting);
		this.applyTheme();
	},

	/**
	 * 应用主题
	 */
	applyTheme() {
		document.documentElement.setAttribute('data-theme', this.currentTheme);
		document.documentElement.classList.toggle('dark-theme', this.currentTheme === 'dark');
	},

	/**
	 * 获取主题图标
	 */
	getThemeIcon() {
		return this.currentTheme === 'dark' ? '🌙' : '☀️';
	},

	/**
	 * 获取主题名称
	 */
	getThemeName() {
		return this.currentTheme === 'dark' ? I18nService.t('theme.dark') : I18nService.t('theme.light');
	}

};
