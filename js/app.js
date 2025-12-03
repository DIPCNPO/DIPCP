/**
 * DIPCP应用主入口
 * 管理整个应用的状态和生命周期
 */
class DIPCPApp {
	constructor() {
		// 路由相关属性
		this.routes = new Map();
		// 检测并保存基础路径（支持子目录部署）
		this.basePath = this.detectBasePath();
		// 用户数据
		this.user = null;
		// 设置数据
		this.setting = null;
		// 未读通知数据
		this.issues = [];
		// 待提交文件列表（按仓库组织：{ repoName: [pendingFiles] }）
		this.pendingFiles = {};
		// 延迟1秒检查未读Issues
		this._startCheckingUnreadIssues();
	}

	/**
	 * 检测应用的基础路径
	 * 如果部署在子目录（如 /DIPCP/），则返回该路径，否则返回 '/'
	 * 基础路径应该从 index.html 的位置确定，而不是当前页面路径
	 * @returns {string} 基础路径
	 */
	detectBasePath() {
		// 方法1：优先从URL路径检测（适用于 /DIPCP, /DIPCP/, /DIPCP/login 等情况）
		const path = window.location.pathname;
		if (path.startsWith('/DIPCP')) {
			return '/DIPCP/';
		}

		// 方法2：尝试从 script 标签的 src 属性中获取基础路径
		// 查找包含 'app.js' 的 script 标签
		const scripts = document.getElementsByTagName('script');
		for (let script of scripts) {
			if (script.src && script.src.includes('app.js')) {
				try {
					const url = new URL(script.src);
					let path = url.pathname;
					// 移除 /js/app.js 部分，获取基础路径
					// 如果路径是 /js/app.js，基础路径应该是 /
					// 如果路径是 /DIPCP/js/app.js，基础路径应该是 /DIPCP/
					path = path.replace(/\/js\/[^\/]+\.js$/, '');
					// 如果路径为空或只有 /，使用根目录
					if (!path || path === '/') {
						path = '/';
					} else {
						// 确保以 / 结尾
						if (!path.endsWith('/')) {
							path += '/';
						}
					}
					return path;
				} catch (e) {
					console.warn('无法从 script 标签解析基础路径:', e);
				}
			}
		}

		// 方法3：如果路径包含 index.html，使用包含 index.html 的目录作为基础路径
		if (path.includes('index.html')) {
			let basePath = path.replace(/\/index\.html.*$/, '');
			if (basePath && !basePath.endsWith('/')) {
				basePath += '/';
			}
			if (!basePath) {
				basePath = '/';
			}
			return basePath;
		}

		// 默认返回根目录
		return '/';
	}

	/**
	 * 获取相对于基础路径的路径
	 * @param {string} path - 完整路径
	 * @returns {string} 相对于基础路径的路径
	 */
	getRelativePath(path) {
		if (this.basePath === '/') {
			return path;
		}
		// 规范化基础路径（去除末尾斜杠用于匹配）
		const basePathForMatch = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;

		// 移除基础路径前缀
		if (path.startsWith(basePathForMatch)) {
			const relative = path.slice(basePathForMatch.length);
			// 如果移除后为空，返回 '/'，否则确保以 '/' 开头
			return relative || '/';
		}
		// 如果不匹配基础路径，返回原路径
		return path;
	}

	/**
	 * 获取完整路径（包含基础路径）
	 * @param {string} path - 相对路径
	 * @returns {string} 完整路径
	 */
	getFullPath(path) {
		if (this.basePath === '/') {
			// 确保路径以 / 开头
			if (!path.startsWith('/')) {
				path = '/' + path;
			}
			return path;
		}

		// 确保路径以 / 开头
		if (!path.startsWith('/')) {
			path = '/' + path;
		}

		// 检查路径是否已经包含基础路径
		const baseForMatch = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
		if (path.startsWith(baseForMatch)) {
			// 路径已经包含基础路径，直接返回（但需要规范化）
			return path.replace(/\/+/g, '/');
		}

		// 移除基础路径末尾的 /，然后拼接
		const base = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
		return base + path;
	}

	/**
	 * 初始化应用程序
	 * 按顺序加载外部库、脚本、服务，然后初始化主题、认证和路由
	 * @async
	 * @returns {Promise<void>}
	 */
	async init() {
		// 1. 等待所有服务加载完成
		await this.waitForServices();

		// 2. 初始化设置，StorageService会在第一次调用时自动初始化数据库
		this.setting = await window.StorageService.getKV('setting');
		if (!this.setting) {
			this.setting = {
				DIPCP_star: false,
				creation_star: [],
				dark_mode: true,
				language: navigator.language || navigator.userLanguage,
				font_size: 16,
				sync_interval: 5,
				last_update: new Date(),
				always_refresh: false,
				show_message: true,
				third_party: false,
				third_parties: [],
				read_path: [],
				read_path_index: -1,
				cursor_position: 0,
				current_page: '',
				current_article: '',
				current_repo: '',
			};
			await window.StorageService.saveKV('setting', this.setting);
		}

		// 3. 应用语言设置（从i18n服务获取）
		await I18nService.init();

		// 4. 应用主题设置
		await ThemeService.init();
		document.documentElement.setAttribute('lang', window.I18nService.currentLanguage);

		// 5. 获取用户数据
		this.user = await window.StorageService.getKV('user');
		if (this.user) window.GitHubService.init(this.user.token);

		// 6. 初始化待提交文件列表
		await this.loadPendingFiles();

		// 7. 初始化路由
		this.initRouter();

		// 8. 渲染初始页面
		await this.handleRouteChange();
	}

	/**
	 * 等待所有必需的服务加载完成
	 * 检查 I18nService、StorageService 、ThemeService和 Octokit 是否可用
	 * @async
	 * @returns {Promise<void>}
	 */
	async waitForServices() {
		// 确保所有服务都已加载
		while (!window.I18nService || !window.StorageService || !window.Octokit || !window.ThemeService) {
			await new Promise(resolve => setTimeout(resolve, 10));
		}
	}

	/**
	 * 初始化路由系统
	 * 定义所有路由规则，设置事件监听器
	 * @returns {void}
	 */
	initRouter() {
		// 定义路由
		this.routes.set('/', 'LoginPage');
		this.routes.set('/creations', 'CreationsPage');
		this.routes.set('/view', 'ViewPage');
		this.routes.set('/editor', 'EditorPage');
		this.routes.set('/submit', 'SubmitPage');
		this.routes.set('/notices', 'NoticesPage');
		this.routes.set('/settings', 'SettingsPage');
		this.routes.set('/terms', 'TermsPage');
		this.routes.set('/privacy', 'PrivacyPage');

		// 监听浏览器前进后退
		window.addEventListener('popstate', () => {
			this.handleRouteChange();
		});

		// 监听链接点击
		document.addEventListener('click', (e) => {
			// 查找最近的带有 data-route 属性的元素（包括自身）
			const routeElement = e.target.closest('[data-route]');
			if (routeElement) {
				e.preventDefault();
				e.stopPropagation();
				this.navigateTo(routeElement.dataset.route);
			}
		});
	}

	/**
	 * 导航到指定路径
	 * @param {string} path - 目标路径（相对于基础路径）
	 * @returns {void}
	 */
	async navigateTo(path) {
		const fullPath = this.getFullPath(path);
		history.pushState(null, '', fullPath);
		// 只有在setting存在时才更新current_page
		if (this.setting) {
			this.setting.current_page = path;
			await window.StorageService.saveKV('setting', this.setting);
		}
		await this.handleRouteChange();
	}

	/**
	 * 处理路由变化
	 * 根据用户认证状态决定重定向逻辑，渲染对应页面
	 * @async
	 * @returns {Promise<void>}
	 */
	async handleRouteChange() {
		const fullPath = window.location.pathname + window.location.search;
		const path = window.location.pathname;
		// 获取相对于基础路径的路径
		const relativePath = this.getRelativePath(path);
		let route = this.matchRoute(relativePath);

		// 检查用户和仓库信息状态
		const hasUser = this.user;
		const hasRepository = hasUser && this.setting.current_repo !== '';

		// 允许未登录用户访问的公开页面
		const publicRoutes = ['/terms', '/privacy'];
		const isPublicRoute = publicRoutes.includes(relativePath);

		// 如果未登录用户，重定向到登录页面（但允许访问公开页面）
		if (!hasUser) {
			// 如果是公开页面，允许访问
			if (isPublicRoute) {
				await this.renderPage(route, fullPath);
				return;
			}
			// 如果当前路径不是根路径，直接更新URL并渲染登录页，避免循环调用
			if (relativePath !== '/' && relativePath !== '') {
				const loginFullPath = this.getFullPath('/');
				history.replaceState(null, '', loginFullPath);
				route = 'LoginPage';
				await this.renderPage(route, loginFullPath);
				return;
			}
			route = 'LoginPage';
			await this.renderPage(route, fullPath);
			return;
		}

		// 如果已登录用户但没有当前阅读的作品，重定向到作品列表页面
		if (!hasRepository) {
			if (relativePath !== '/creations') {
				await this.navigateTo('/creations');
				return;
			}
			route = 'CreationsPage';
			await this.renderPage(route, fullPath);
			return;
		}

		// 处理根路径重定向（考虑基础路径）
		if (relativePath === '/' || relativePath === '') {
			if (hasUser && hasRepository) {
				// 有用户信息和当前阅读的作品，重定向到对应页面
				if (this.setting.current_page === '') {
					if (relativePath !== '/view') {
						await this.navigateTo('/view');
						return;
					}
					route = 'ViewPage';
				} else {
					const target = this.setting.current_page;
					if (relativePath !== target) {
						await this.navigateTo(target);
						return;
					}
					route = this.matchRoute(target);
				}
			}
		}

		// 其他路径，直接渲染对应页面
		if (route) {
			await this.renderPage(route, fullPath);
		}
	}

	/**
	 * 匹配路由
	 * 根据路径匹配对应的页面类名（使用相对路径）
	 * @param {string} path - 要匹配的路径（应该是相对路径）
	 * @returns {string} 页面类名
	 */
	matchRoute(path) {
		// 确保路径以 / 开头
		if (!path.startsWith('/')) {
			path = '/' + path;
		}

		// 规范化路径：移除尾随斜杠（除非是根路径）
		const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');

		// 精确匹配（先尝试规范化路径）
		if (this.routes.has(normalizedPath)) {
			return this.routes.get(normalizedPath);
		}

		// 也尝试原始路径（向后兼容）
		if (this.routes.has(path)) {
			return this.routes.get(path);
		}

		// 参数匹配 - 支持查询参数（使用规范化路径）
		for (const [pattern, pageClass] of this.routes) {
			if (this.isMatch(pattern, normalizedPath)) {
				return pageClass;
			}
		}

		// 默认路由
		return 'LoginPage';
	}

	/**
	 * 检查路径是否匹配模式
	 * 支持精确匹配和参数匹配
	 * @param {string} pattern - 匹配模式
	 * @param {string} path - 要检查的路径
	 * @returns {boolean} 是否匹配
	 */
	isMatch(pattern, path) {
		if (pattern === path) return true;

		// 移除查询参数进行匹配
		const pathWithoutQuery = path.split('?')[0];
		const patternWithoutQuery = pattern.split('?')[0];

		// 规范化路径：移除尾随斜杠（除非是根路径）
		const normalizedPath = pathWithoutQuery === '/' ? '/' : pathWithoutQuery.replace(/\/+$/, '');
		const normalizedPattern = patternWithoutQuery === '/' ? '/' : patternWithoutQuery.replace(/\/+$/, '');

		// 精确匹配（无查询参数，规范化后）
		if (normalizedPattern === normalizedPath) return true;

		// 参数匹配
		const patternParts = normalizedPattern.split('/');
		const pathParts = normalizedPath.split('/');

		if (patternParts.length !== pathParts.length) return false;

		for (let i = 0; i < patternParts.length; i++) {
			if (patternParts[i].startsWith(':')) continue;
			if (patternParts[i] !== pathParts[i]) return false;
		}

		return true;
	}

	/**
	 * 渲染页面
	 * 创建页面实例，设置属性，渲染并挂载到DOM
	 * @async
	 * @param {string} pageClass - 页面类名
	 * @param {string} fullPath - 完整路径（包含查询参数）
	 * @returns {Promise<void>}
	 */
	async renderPage(pageClass, fullPath) {
		// 销毁当前页面
		if (this.currentPage) {
			this.currentPage.destroy();
		}

		// 创建新页面
		const PageClass = window[pageClass];
		if (!PageClass) {
			console.error(`Page class ${pageClass} not found`);
			return;
		}

		// 解析查询参数
		const url = new URL(fullPath, window.location.origin);
		const queryParams = Object.fromEntries(url.searchParams);

		// 为不同页面添加必要的参数
		let pageProps = { queryParams };
		if (pageClass === 'TermsPage' || pageClass === 'PrivacyPage') {
			pageProps = {
				...pageProps,
				onBack: () => {
					this.navigateTo('/login');
				}
			};
		} else if (pageClass === 'EditorPage') {
			// 为EditorPage添加文件路径和模式参数
			pageProps = {
				...pageProps,
				onBack: () => {
					this.navigateTo('/view');
				}
			};
		}

		this.currentPage = new PageClass(pageProps);

		// 挂载到DOM（mount方法内部会调用render，并传递fullPath参数）
		await this.mountPage(fullPath);
	}

	/**
	 * 挂载页面到DOM
	 * 将当前页面组件挂载到应用容器中
	 * @param {string} fullPath - 完整路径
	 * @returns {Promise<void>}
	 */
	async mountPage(fullPath) {
		const appContainer = document.getElementById('app');
		if (appContainer && this.currentPage) {
			// 清空容器
			appContainer.innerHTML = '';
			// 挂载页面组件，传递fullPath参数
			await this.currentPage.mount(appContainer, fullPath);
		}
	}

	/**
	 * 解析路径
	 * 从路径中提取作者、仓库名、目录路径、文件名、扩展名、完整文件名
	 * @param {string} path - 路径
	 * @returns {Object|null} 包含owner、repo、dirPath、filename、extension、fullFilename的对象，解析失败返回null
	 */
	parsePath(path) {
		if (!path || typeof path !== 'string') return null;
		// 去掉前导斜杠，规范化分隔
		const normalized = path.replace(/^\/+/, '');
		const parts = normalized.split('/');
		const owner = parts[0];
		const repo = parts[1];
		const lastPart = parts[parts.length - 1];
		const lastDotIndex = lastPart.lastIndexOf('.');
		// 需要存在扩展名，且不在首尾
		if (lastDotIndex <= 0 || lastDotIndex === lastPart.length - 1) return null;

		const filename = lastPart.slice(0, lastDotIndex);
		const extension = lastPart.slice(lastDotIndex + 1);
		// 如果是3段路径（author/repo/file.ext），dirPath为空字符串
		// 如果是4段或更多，dirPath为中间部分
		const dirPath = parts.length > 3 ? parts.slice(2, -1).join('/') : '';
		const fullFilename = lastPart;

		return { owner, repo, dirPath, filename, extension, fullFilename };
	}

	/**
	 * 解析文章内容
	 * @param {string} content - 文章内容
	 * @returns {Object} 解析结果
	 */
	parseArticleContent(content) {
		if (!content) {
			return {
				header: null,
				version: null,
				penName: null,
				updateTime: null,
				createTime: null,
				content: '',
			};
		}

		const lines = content.split('\n');
		let version = null;
		let penName = null;
		let updateTime = null;
		let createTime = null;
		let contents = '';
		let header = '';

		// 检查是否有标准格式的元数据（前4行是pen_name、version、update_time、create_time）
		const hasMetadata = lines.length >= 3 &&
			lines[0].startsWith('pen_name:') &&
			lines[1].startsWith('version:') &&
			lines[2].startsWith('update_time:') &&
			lines[3].startsWith('create_time:');

		if (hasMetadata) {
			header = lines.slice(0, 4).join('\n').trim();
			// 解析前4行元数据
			penName = lines[0].replace('pen_name:', '').trim();
			version = lines[1].replace('version:', '').trim();
			updateTime = lines[2].replace('update_time:', '').trim();
			createTime = lines[3].replace('create_time:', '').trim();
			contents = lines.slice(4).join('\n').trim();
		} else {
			// 没有标准格式，是普通文件
			contents = content.trim();
		}

		return {
			header,
			version,
			penName,
			updateTime,
			createTime,
			content: contents,
		};
	}

	/**
	 * 开始定期检查未读Issues
	 */
	_startCheckingUnreadIssues() {
		// 如果已经有定时器在运行，先清除
		if (this.checkInterval) {
			clearTimeout(this.checkInterval);
			this.checkInterval = null;
		}

		// 延迟检查，确保页面完全加载
		setTimeout(() => {
			// 立即检查一次
			this._checkUnreadIssues();

			// 开始持续检查
			this._scheduleNextCheck();
			this._checkNotice();
		}, 5000);
	}

	/**
	 * 安排下一次检查
	 */
	_scheduleNextCheck() {
		// 如果setting不存在或用户未登录，不安排检查
		if (!window.app.setting || !window.app.user) {
			return;
		}
		// 获取同步时间间隔(毫秒)
		const syncInterval = window.app.setting.sync_interval * 60000;

		// 设置下一次检查
		this.checkInterval = setTimeout(() => {
			// 执行检查
			this._checkUnreadIssues();
			// 检查组织邀请
			this._checkNotice();

			// 检查是否需要发送投票数据
			if (!window.app.setting.last_update) {
				window.app.setting.last_update = new Date();
				window.StorageService.saveKV('setting', window.app.setting);
			}
			const lastUpdate = new Date(window.app.setting.last_update);
			const now = new Date();
			const diffTime = Math.abs(now - lastUpdate);
			const diffMinutes = Math.ceil(diffTime / (1000 * 60));
			if (diffMinutes >= 60) {
				this._sendVotingData();
				window.app.setting.last_update = now;
				window.StorageService.saveKV('setting', window.app.setting);
			}

			// 安排下一次检查
			this._scheduleNextCheck();
		}, syncInterval);
	}

	/**
	 * 发送投票数据
	 * 向作品根仓库的 Issue #1 写入 commit（评论），包含 path 和 vote 字段的数组
	 * @returns {Promise<void>}
	 */
	async _sendVotingData() {
		try {
			// 1. 获取投票数据
			const votingData = await window.StorageService.clearVoting();

			// 如果没有投票数据，直接返回
			if (!votingData || votingData.length === 0) {
				return;
			}

			// 2. 获取当前根仓库信息
			const currentRepo = window.app.setting?.current_repo;
			if (!currentRepo) {
				console.warn('⚠️ [_sendVotingData] 当前仓库信息不存在，跳过发送投票数据');
				return;
			}

			// 解析仓库信息（格式：owner/repo）
			const parts = currentRepo.split('/');
			if (parts.length !== 2) {
				console.warn('⚠️ [_sendVotingData] 仓库格式无效:', currentRepo);
				return;
			}

			const [owner, repo] = parts;

			// 3. 构建投票数据数组（只包含 path 和 vote 字段）
			const votingArray = votingData.map(item => ({
				path: item.path,
				vote: item.vote
			}));

			// 4. 将投票数据转换为 JSON 字符串
			const votingJson = JSON.stringify(votingArray);

			// 5. 向 Issue #1 添加评论（作为 commit）
			await window.GitHubService.safeCall(async (octokit) => {
				await octokit.rest.issues.createComment({
					owner,
					repo,
					issue_number: 1,
					body: votingJson
				});
			});

			console.log(`✅ [_sendVotingData] 成功发送 ${votingArray.length} 条投票数据到 ${owner}/${repo} 的 Issue #1`);

		} catch (error) {
			console.error('❌ [_sendVotingData] 发送投票数据失败:', error);
			// 不抛出错误，避免影响其他定时任务
		}
	}

	/**
	 * 检查并更新未读Issues列表
	 */
	async _checkUnreadIssues() {
		try {
			if (!window.app.user || !window.app.user.creations || !window.app.user.creations.length) {
				return;
			}

			for (const creation of window.app.user.creations) {
				const segments = creation.split('/');
				const issues = await window.GitHubService.listIssues(segments[0], segments[1], {
					state: 'open',
					sort: 'created',
					direction: 'desc',
					per_page: 100
				});

				window.app.issues = issues.filter(issue => issue.title.startsWith('Link Request:') || issue.title.startsWith('Application result:'));
			}

			// 更新导航按钮显示
			if (window.app.issues && window.app.issues.length > 0) {
				if (this.currentPage && typeof this.currentPage.handleIssues === 'function') {
					this.currentPage.handleIssues();
				}
			}

		} catch (error) {
			console.error('❌ [_checkUnreadIssues] 检查未读Issues失败:', error);
		}
	}

	/**
	 * 检查并更新未读通知列表
	 * 自动获取并接受来自 DIPCNPO 的组织邀请
	 */
	async _checkNotice() {
		try {
			const octokit = window.GitHubService.getOctokit();
			if (!octokit) {
				return;
			}

			// 获取待处理的组织成员资格邀请
			// 使用 GET /user/memberships/orgs?state=pending 获取待处理的邀请
			const { data: memberships } = await octokit.rest.orgs.listMembershipsForAuthenticatedUser({
				state: 'pending'
			});

			// 筛选出 DIPCNPO 组织的邀请
			const dipcnpoInvitations = memberships.filter(
				membership => membership.organization.login === 'DIPCNPO'
			);

			if (dipcnpoInvitations.length === 0) {
				return;
			}

			// 接受所有 DIPCNPO 组织的邀请
			for (const invitation of dipcnpoInvitations) {
				try {
					await octokit.rest.orgs.updateMembershipForAuthenticatedUser({
						org: 'DIPCNPO',
						state: 'active'
					});
					console.log(`✅ 已接受 DIPCNPO 组织邀请`);
				} catch (error) {
					console.warn(`⚠️ 接受 DIPCNPO 组织邀请失败:`, error.message);
					// 如果邀请已被接受或已过期，这是正常情况，不需要报错
					if (error.status !== 404 && error.status !== 422) {
						console.error('接受组织邀请时出错:', error);
					}
				}
			}
		} catch (error) {
			// 静默处理错误，避免影响其他功能
			if (error.status === 401) {
				console.warn('未授权，无法检查组织邀请');
			} else if (error.status !== 404) {
				console.warn('检查组织邀请时出错:', error.message);
			}
		}
	}

	/**
	 * 加载所有待提交文件到全局状态
	 * 按仓库组织：{ repoName: [pendingFiles] }
					  turns {Promise<void>}
	 */
	async loadPendingFiles() {
		try {
			// 获取所有待提交文件
			const allPendingFiles = await window.StorageService.execute('pending', 'getAll');

			// 按仓库组织
			this.pendingFiles = {};
			allPendingFiles.forEach(file => {
				if (!this.pendingFiles[file.repo]) {
					this.pendingFiles[file.repo] = [];
				}
				this.pendingFiles[file.repo].push(file);
			});
		} catch (error) {
			console.error('加载待提交文件失败:', error);
			this.pendingFiles = {};
		}
	}

	/**
	 * 更新待提交文件状态（添加或删除）
	 * 同时更新全局状态和 Header 组件显示
	 * @param {string} path - 文件路径
	 * @param {boolean} isAdd - true表示添加，false表示删除
	 * @returns {Promise<void>}
	 */
	async updatePendingFile(path, isAdd) {
		try {
			// 解析文件路径获取仓库名
			const parsed = window.app.parsePath(path);

			if (!parsed || !parsed.repo) {
				console.warn('⚠️ [updatePendingFile] 无法解析文件路径:', path);
				return;
			}

			const repoName = parsed.repo;

			if (isAdd) {
				// 添加到全局状态
				if (!this.pendingFiles[repoName]) {
					this.pendingFiles[repoName] = [];
				}
				// 检查是否已存在
				if (!this.pendingFiles[repoName].some(f => f.path === path)) {
					this.pendingFiles[repoName].push({ path, repo: repoName });
				}
			} else {
				// 从全局状态中删除
				if (this.pendingFiles[repoName]) {
					const beforeLength = this.pendingFiles[repoName].length;
					this.pendingFiles[repoName] = this.pendingFiles[repoName].filter(f => f.path !== path);
					const afterLength = this.pendingFiles[repoName].length;

					// 如果没有文件了，删除该仓库的键
					if (this.pendingFiles[repoName].length === 0) {
						delete this.pendingFiles[repoName];
					}
				}
			}

			// 更新 Header 组件的显示
			this.updatePendingFilesBadge();
		} catch (error) {
			console.error('❌ [updatePendingFile] 更新待提交文件状态失败:', error);
		}
	}

	/**
	 * 更新 Header 组件中提交按钮的红点显示
	*/
	updatePendingFilesBadge() {
		// 找到当前页面中的 Header 组件并更新
		if (window.app && window.app.currentPage) {
			if (window.app.currentPage.headerComponent) {
				// 确保 headerComponent 的 element 属性已设置
				const headerComponent = window.app.currentPage.headerComponent;
				if (!headerComponent.element) {
					// 尝试从 DOM 中查找 header 元素
					const headerElement = document.querySelector('header.header');
					if (headerElement) {
						headerComponent.element = headerElement;
					}
				}

				headerComponent.updateNavigationButtons();
			} else {
				console.warn('⚠️ [updatePendingFilesBadge] headerComponent 不存在');
			}
		} else {
			console.warn('⚠️ [updatePendingFilesBadge] currentPage 不存在');
		}
	}

	/**
	 * 检查指定仓库是否有待提交文件
	 * @param {string} repoName - 仓库名
	 * @returns {boolean} 是否有待提交文件
	 */
	hasPendingFiles(repoName) {
		if (!repoName || !this.pendingFiles) {
			return false;
		}
		const files = this.pendingFiles[repoName];
		return files && files.length > 0;
	}

}

//创建全局应用实例
window.app = new DIPCPApp();