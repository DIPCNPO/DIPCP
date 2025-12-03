/**
 * 页面头部组件
 * 包含Logo和5个图标按钮：后退、阅读、通知、提交、设定
 */
class Header extends Component {
	constructor(props = {}) {
		super(props);
	}

	/**
	 * 渲染头部组件
	 * @returns {Promise<HTMLElement>} 头部组件DOM元素
	 */
	render() {
		const header = document.createElement('header');
		header.className = 'header';
		header.innerHTML = `
            <div class="header-left">
                <h1 class="logo">DIPCP</h1>
            </div>
            <nav class="header-nav-buttons">
                ${this.renderNavButtons()}
            </nav>
        `;
		return header;
	}

	/**
	 * 渲染导航按钮
	 * @returns {string} 导航按钮HTML字符串
	 */
	renderNavButtons() {
		// 检查是否有未读通知
		const hasUnreadNotices = this.hasUnreadNotices();
		// 检查是否有待提交文件
		const hasPendingFiles = this.hasPendingFiles();

		// 获取基础路径
		const basePath = window.app?.basePath || '/';

		// 5个固定按钮：后退、阅读、通知、提交、设定
		const buttons = [
			{
				href: '/creations',
				key: 'navigation.back',
				icon: '🔙',
			},
			{
				href: '/view',
				key: 'navigation.view',
				icon: '📖',
			},
			{
				href: '/notices',
				key: 'navigation.notices',
				icon: '🔔',
				showBadge: hasUnreadNotices
			},
			{
				href: '/submit',
				key: 'navigation.submit',
				icon: '✅',
				showBadge: hasPendingFiles
			},
			{
				href: '/settings',
				key: 'navigation.settings',
				icon: '⚙️',
			}
		];

		return buttons.map(button => {
			// 构建完整路径（包含基础路径）用于 href 属性
			// 这样即使 JavaScript 失败，浏览器也能正确导航
			const fullHref = basePath === '/' ? button.href : basePath.replace(/\/$/, '') + button.href;
			const isActive = button.href.includes(window.app.setting.current_page) ? 'active' : '';

			const notificationBadge = button.showBadge
				? '<span class="nav-notification-badge"></span>' : '';

			return `
                <a href="${fullHref}" 
                   class="nav-button ${isActive}" 
                   data-route="${button.href}" >
                    <span class="nav-button-icon">${button.icon}</span>
                    ${notificationBadge}
                </a>
            `;
		}).join('');
	}

	/**
	 * 更新导航按钮（用于刷新通知徽章和active状态）
	 */
	updateNavigationButtons() {
		// 如果 element 不存在，尝试从 DOM 中查找
		if (!this.element) {
			const headerElement = document.querySelector('header.header');
			if (headerElement) {
				this.element = headerElement;
			} else {
				console.warn('⚠️ [Header.updateNavigationButtons] element 不存在且无法从 DOM 中找到');
				return;
			}
		}

		const navButtons = this.element.querySelectorAll('.nav-button');

		if (!navButtons.length) {
			console.warn('⚠️ [Header.updateNavigationButtons] 没有找到导航按钮');
			return;
		}

		// 检查是否有未读通知
		const hasUnreadNotices = this.hasUnreadNotices();
		// 检查是否有待提交文件
		const hasPendingFiles = this.hasPendingFiles();

		navButtons.forEach((button, index) => {
			const href = button.getAttribute('href');
			const dataRoute = button.getAttribute('data-route');
			if (!href) return;

			// 更新 active 状态
			const isActive = href.includes(window.app.setting.current_page);
			if (isActive) {
				button.classList.add('active');
			} else {
				button.classList.remove('active');
			}

			// 使用 data-route 属性来匹配按钮（因为 href 包含基础路径）
			const route = dataRoute || href;

			// 更新通知徽章（只针对通知按钮）
			if (route === '/notices') {
				const existingBadge = button.querySelector('.nav-notification-badge');
				if (hasUnreadNotices && !existingBadge) {
					const badge = document.createElement('span');
					badge.className = 'nav-notification-badge';
					button.appendChild(badge);
				} else if (!hasUnreadNotices && existingBadge) {
					existingBadge.remove();
				}
			}

			// 更新提交按钮徽章
			if (route === '/submit') {
				const existingBadge = button.querySelector('.nav-notification-badge');

				if (hasPendingFiles && !existingBadge) {
					const badge = document.createElement('span');
					badge.className = 'nav-notification-badge';
					button.appendChild(badge);
				} else if (!hasPendingFiles && existingBadge) {
					existingBadge.remove();
				}
			}
		});
	}

	/**
	 * 检查是否有未读通知（包括Issues）
	 * @returns {boolean} 是否有未读通知
	 */
	hasUnreadNotices() {
		return window.app.issues && window.app.issues.length > 0;
	}

	/**
	 * 检查是否有待提交文件
	 * @returns {boolean} 是否有待提交文件
	 */
	hasPendingFiles() {
		const currentRepo = window.app.setting?.current_repo;
		if (!currentRepo) {
			return false;
		}

		const repoName = currentRepo.split('/')[1];
		const result = window.app.hasPendingFiles(repoName);
		return result;
	}

	/**
	 * 设置当前页面
	 * @param {string} page - 页面名称
	 */
	async setCurrentPage(page) {
		window.app.setting.current_page = page;
		await window.StorageService.saveKV('setting', window.app.setting);
		// 更新导航按钮的 active 状态（不重新渲染，只更新 DOM）
		this.updateNavigationButtons();
	}
}

// 导出组件
window.Header = Header;
