/**
 * 隐私政策页面组件
 * 从Markdown文件读取内容，根据当前语言加载对应的文件
 */
class PrivacyPage extends BasePage {
	constructor(props = {}) {
		super(props);
		this.state = {
			onBack: props.onBack || null,
			content: null, // Markdown内容
			loading: true
		};

		// 监听语言变化事件
		this.handleLanguageChange = this.handleLanguageChange.bind(this);
	}

	handleLanguageChange() {
		// 语言变化时重新加载内容并渲染
		this.loadContent();
	}

	/**
	 * 重新渲染组件
	 */
	rerender() {
		// 重新渲染整个页面内容
		if (this.element) {
			this.element.innerHTML = '';

			if (this.state.loading) {
				this.element.innerHTML = `
					<div class="legal-content">
						<p>${this.t('common.loading', '加载中...')}</p>
					</div>
				`;
			} else {
				const newContent = this.render();
				this.element.appendChild(newContent);
			}
		}
		this.bindEvents();
	}

	async mount(element) {
		super.mount(element);
		this.bindEvents();

		// 添加语言变化监听器
		document.addEventListener('languageChanged', this.handleLanguageChange);

		// 加载内容
		await this.loadContent();
	}

	destroy() {
		// 移除语言变化监听器
		document.removeEventListener('languageChanged', this.handleLanguageChange);
		super.destroy();
	}

	/**
	 * 加载Markdown内容
	 */
	async loadContent() {
		try {
			this.state.loading = true;

			// 获取当前语言
			const language = window.I18nService ? window.I18nService.getCurrentLanguage().split('-')[0] : 'zh';

			// 根据语言加载对应的Markdown文件
			const fileName = `Privacy_Policy_${language}.md`;
			const filePath = window.app ? window.app.getFullPath(`/docs/${fileName}`) : `/docs/${fileName}`;

			// 使用fetch加载Markdown文件
			const response = await fetch(filePath);
			if (!response.ok) {
				throw new Error(`Failed to load file: ${response.statusText}`);
			}

			const markdown = await response.text();

			// 将Markdown转换为HTML（使用简单的转换）
			const html = this.markdownToHtml(markdown);

			this.state.content = html;
			this.state.loading = false;
			this.rerender();
		} catch (error) {
			console.error('Failed to load privacy content:', error);
			// 加载失败时显示错误信息
			this.state.content = `<div class="error">加载内容失败: ${error.message}</div>`;
			this.state.loading = false;
			this.rerender();
		}
	}

	render() {
		const container = document.createElement('div');

		if (this.state.loading) {
			container.className = 'legal-container';
			container.innerHTML = `
				<div class="legal-content">
					<p>${this.t('common.loading', '加载中...')}</p>
				</div>
			`;
			return container;
		}

		container.className = 'legal-container';
		container.innerHTML = `
			<div class="legal-content">
				${this.state.content || '<p>暂无内容</p>'}
			</div>
			${this.renderFooter()}
		`;
		return container;
	}

	renderFooter() {
		// 从i18n读取页脚文字
		const backLink = this.t('footer.backLink', '返回登录页面');

		return `
			<div class="legal-footer">
				<p>© 2025 DIPCNPO. All rights reserved.</p>
				<a href="#" class="back-link">${backLink}</a>
			</div>
		`;
	}

	bindEvents() {
		// 返回链接
		const backLink = this.element?.querySelector('.back-link');
		if (backLink) {
			backLink.addEventListener('click', (e) => {
				e.preventDefault();
				this.handleBack();
			});
		}
	}

	handleBack() {
		// 返回到登录页面
		if (window.app && window.app.navigateTo) {
			window.app.navigateTo('/');
		}
	}
}

// 注册组件
window.PrivacyPage = PrivacyPage;