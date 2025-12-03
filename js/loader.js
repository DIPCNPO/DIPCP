/**
 * 动态加载器
 * 在i18n服务完全加载后，动态加载其他所有JS文件
 */

class DynamicLoader {
	constructor() {
		this.loadedScripts = new Set();
		this.loadPromises = new Map();
	}

	/**
	 * 动态加载单个脚本
	 */
	async loadScript(src) {
		if (this.loadedScripts.has(src)) {
			return Promise.resolve();
		}

		if (this.loadPromises.has(src)) {
			return this.loadPromises.get(src);
		}

		const promise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = src;
			script.onload = () => {
				this.loadedScripts.add(src);
				resolve();
			};
			script.onerror = () => {
				console.error(`Failed to load script: ${src}`);
				reject(new Error(`Failed to load script: ${src}`));
			};
			document.head.appendChild(script);
		});

		this.loadPromises.set(src, promise);
		return promise;
	}

	/**
	 * 动态加载ES模块
	 */
	async loadESModule(src) {
		if (this.loadedScripts.has(src)) {
			return Promise.resolve();
		}

		if (this.loadPromises.has(src)) {
			return this.loadPromises.get(src);
		}

		const promise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.type = 'module';
			script.src = src;
			script.onload = () => {
				this.loadedScripts.add(src);
				resolve();
			};
			script.onerror = () => {
				console.error(`Failed to load ES module: ${src}`);
				reject(new Error(`Failed to load ES module: ${src}`));
			};
			document.head.appendChild(script);
		});

		this.loadPromises.set(src, promise);
		return promise;
	}

	/**
	 * 加载外部库
	 */
	async loadExternalLibraries() {
		// 加载Octokit库并设置到全局
		const octokitScript = document.createElement('script');
		octokitScript.type = 'module';
		octokitScript.innerHTML = `
			import { Octokit } from "https://esm.sh/@octokit/rest";
			window.Octokit = Octokit;
		`;
		document.head.appendChild(octokitScript);

		// 等待Octokit库完全加载并设置到全局
		while (!window.Octokit) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		console.log('✅ Octokit库加载完成');
	}

	/**
	 * 批量加载脚本（分组并行加载）
	 */
	async loadScripts(scripts) {
		// 定义依赖关系组
		const dependencyGroups = [
			// 第一组：基础服务
			[
				'js/services/github-service.js',
				'js/services/storage-service.js',
				'js/services/theme-service.js'
			],
			// 第二组：本地库
			[
				'js/sodium.js',
				'js/JSZip.js',
				'js/codemirror.js',
				'js/marker.min.js'
			],
			// 第三组：组件基类（需最先加载）
			[
				'js/components/Component.js'
			],
			// 第四组：组件实现
			[
				'js/components/Modal.js',
				'js/components/Header.js',
			],
			// 第五组：页面基类
			[
				'js/pages/BasePage.js'
			],
			// 第六组：页面组件（依赖BasePage）
			[
				'js/pages/LoginPage.js',
				'js/pages/ViewPage.js',
				'js/pages/EditorPage.js',
				'js/pages/SubmitPage.js',
				'js/pages/SettingsPage.js',
				'js/pages/NoticesPage.js',
				'js/pages/TermsPage.js',
				'js/pages/PrivacyPage.js',
				'js/pages/CreationsPage.js'
			],
			// 第七组：应用（依赖所有页面）
			[
				'js/app.js'
			]
		];

		// 按组顺序加载，组内并行加载
		for (const group of dependencyGroups) {
			const promises = group.map(src => this.loadScript(src));
			await Promise.all(promises);
		}
	}

	/**
	 * 等待i18n服务完全加载
	 */
	async waitForI18nReady() {
		// 等待i18n服务对象存在
		while (!window.I18nService) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}

		// 初始化i18n服务
		await window.I18nService.init();

		// 等待翻译数据完全加载
		while (!window.I18nService.translations || Object.keys(window.I18nService.translations).length === 0) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}

	/**
	 * 加载所有应用脚本
	 */
	async loadAllScripts() {
		// 1. 首先加载外部库
		await this.loadExternalLibraries();

		// 2. 等待i18n服务完全加载
		await this.waitForI18nReady();

		// 3. 使用分组加载策略加载应用脚本
		await this.loadScripts();
	}

	/**
	 * 初始化应用
	 */
	async init() {
		try {
			await this.loadAllScripts();

			// 所有脚本加载完成后，初始化应用
			if (window.app && typeof window.app.init === 'function') {
				await window.app.init();
			} else {
				console.error('App not found or init method not available');
			}
		} catch (error) {
			console.error('Failed to load application:', error);
		}
	}
}

// 创建全局加载器实例
window.dynamicLoader = new DynamicLoader();

// 页面加载完成后开始加载
document.addEventListener('DOMContentLoaded', () => {
	window.dynamicLoader.init();
});
