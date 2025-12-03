/**
 * GitHub 服务
 * 统一管理所有 GitHub API 请求，包括速率限制处理
 */
window.GitHubService = {
	// Octokit 实例
	_octokit: null,
	// 当前使用的 token
	_token: null,
	// 速率限制状态
	_rateLimitState: null,
	// 速率限制限额
	_rateLimitLimit: null,

	/**
	 * 获取翻译文本
	 * @param {string} key - 翻译键
	 * @param {Object} params - 参数对象（可选）
	 * @returns {string} 翻译后的文本
	 */
	_t(key, params = {}) {
		if (window.I18nService && window.I18nService.t) {
			return window.I18nService.t(key, params);
		}
		// 如果没有 i18n 服务，返回键本身
		return key;
	},

	/**
	 * 初始化 GitHub 服务
	 * @param {string} token - GitHub 访问令牌
	 * @returns {Promise<boolean>} 初始化是否成功
	 */
	async init(token) {
		try {
			// 检查 Octokit 是否可用
			if (typeof window.Octokit === 'undefined') {
				console.warn('Octokit 未加载');
				return false;
			}

			// 如果 token 未变化，不需要重新初始化
			if (this._token === token && this._octokit) {
				return true;
			}

			// 创建 Octokit 实例
			this._octokit = new window.Octokit({ auth: token });
			this._token = token;

			// 设置 Octokit 钩子，拦截所有响应以读取速率限制信息
			this._setupRateLimitHook();

			return true;
		} catch (error) {
			console.error('初始化 GitHub 服务失败:', error);
			return false;
		}
	},

	/**
	 * 检查API速率限制（使用rate_limit API端点）
	 * @returns {Promise<Object>} 速率限制信息 { limit: number, remaining: number }
	 */
	async checkRateLimit() {
		try {
			// 使用专门的rate_limit API端点获取速率限制信息
			const response = await this._octokit.rest.rateLimit.get();
			const { rate } = response.data;

			const limit = rate.limit || 0;
			const remaining = rate.remaining || 0;

			// 保存限额
			if (limit) {
				this._rateLimitLimit = limit;
			}

			return {
				limit: limit,
				remaining: remaining
			};
		} catch (error) {
			console.error('检查速率限制失败:', error);
			throw error;
		}
	},

	/**
	 * 处理 GitHub API 速率限制错误
	 * @param {Error} error - 错误对象
	 * @returns {boolean} 是否是速率限制错误
	 */
	handleRateLimitError(error) {
		// 检查是否是速率限制错误
		let isRateLimitError = false;

		if (!error) {
			return false;
		}

		// 检查错误消息（GraphQL 和 REST）
		if (error.message && (
			error.message.includes('API rate limit exceeded') ||
			error.message.includes('rate limit already exceeded')
		)) {
			isRateLimitError = true;
		}

		// 检查 REST API 错误状态码
		if (error.status === 403 && error.headers &&
			(error.headers['x-ratelimit-remaining'] === '0' ||
				error.headers['retry-after'])) {
			isRateLimitError = true;
		}

		// 检查 GraphQL 错误响应
		if (error.response && error.response.data && error.response.data.errors) {
			const errors = error.response.data.errors;
			for (const gqlError of errors) {
				if (gqlError.message && (
					gqlError.message.includes('API rate limit exceeded') ||
					gqlError.message.includes('rate limit already exceeded')
				)) {
					isRateLimitError = true;
					break;
				}
			}
		}

		if (!isRateLimitError) {
			return false;
		}

		this._rateLimitState = { blockedUntil };

		// 记录速率限制头信息以便调试
		if (error.response && error.response.headers) {
			const limit = error.response.headers['x-ratelimit-limit'];
			console.warn(`⚠️ GitHub API 速率限制已触发，将暂停 1 小时 - 限额: ${limit}/小时`);
		} else {
			console.warn('GitHub API 速率限制已触发，将暂停 1 小时');
		}
		return true;
	},

	/**
	 * 设置 Octokit 钩子以拦截响应头
	 * 在每个 API 调用后自动记录速率限制信息
	 */
	_setupRateLimitHook() {
		if (!this._octokit) {
			return;
		}

		// 使用 Octokit 的钩子系统
		// 拦截所有响应以读取速率限制头部
		this._octokit.hook.before('request', async (options) => {
			// 可以在这里记录请求信息（可选）
		});

		this._octokit.hook.after('request', async (response, options) => {
			// 在所有 API 调用后记录速率限制信息
			//this._logRateLimitInfo(response.headers);
		});

		this._octokit.hook.error('request', async (error, options) => {
			// 错误响应也可能包含速率限制头部
			if (error.response && error.response.headers) {
				this._logRateLimitInfo(error.response.headers);
			}
			// 重要：必须重新抛出错误，否则错误会被吞掉
			throw error;
		});
	},

	/**
	 * 记录速率限制信息到控制台
	 * @param {Object} headers - 响应头对象
	 */
	_logRateLimitInfo(headers) {
		if (!headers) {
			return;
		}

		// 读取速率限制头部
		const remaining = headers['x-ratelimit-remaining'];
		const limit = headers['x-ratelimit-limit'];
		const reset = headers['x-ratelimit-reset'];
		const used = headers['x-ratelimit-used'];

		// 只有在有有效数据时才显示
		if (remaining !== undefined && limit !== undefined && reset !== undefined) {
			// 保存限额
			this._rateLimitLimit = parseInt(limit);

			// 计算重置时间
			const resetDate = new Date(parseInt(reset) * 1000);
			const resetTime = resetDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

			// 计算使用率百分比
			const percentage = ((parseInt(used) / parseInt(limit)) * 100).toFixed(1);

			// 如果limit只有60，说明可能没有使用token认证
			if (parseInt(limit) === 60) {
				console.warn(`⚠️ GitHub API 速率限制: ${remaining}/${limit} (${percentage}% 已使用), 重置时间: ${resetTime} - 这可能表示未使用token认证！`);
			}

		}
	},

	/**
	 * 安全的 GitHub API 调用包装器
	 * 自动检查速率限制并处理错误
	 * @param {Function} apiCall - 要执行的 API 调用函数（返回 Promise）
	 * @returns {Promise} API 调用的结果
	 */
	async safeCall(apiCall) {
		try {
			const result = await apiCall(this._octokit);
			return result;
		} catch (error) {
			console.error('❌ [safeCall] API 调用失败:', {
				errorType: error.constructor.name,
				message: error.message,
				status: error.status,
				responseStatus: error.response?.status,
				responseData: error.response?.data,
				stack: error.stack?.split('\n').slice(0, 5).join('\n')
			});

			// 检查是否是速率限制错误
			if (this.handleRateLimitError(error)) {
				console.error('❌ [safeCall] 检测到速率限制错误');
				// 重新抛出错误，让调用者知道是速率限制
				const remainingTime = this.getRateLimitRemainingTime();
				const hours = Math.floor(remainingTime / (60 * 60 * 1000));
				const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));

				const rateLimitError = new Error(this._t('common.rateLimitExceeded', { hours, minutes }));
				rateLimitError.isRateLimited = true;
				rateLimitError.remainingTime = remainingTime;
				throw rateLimitError;
			}

			// 如果不是速率限制错误，直接抛出
			console.error('❌ [safeCall] 非速率限制错误，直接抛出');
			throw error;
		}
	},

	/**
	 * 获取 Octokit 实例（直接访问，不推荐，建议使用 safeCall）
	 * @returns {Object|null} Octokit 实例
	 */
	getOctokit() {
		return this._octokit;
	},

	// ========== Issues API ==========

	/**
	 * 列出仓库的所有 Issues
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {Object} options - 选项 (state, sort, direction等)
	 * @returns {Promise<Array>} Issues 列表
	 */
	async listIssues(owner, repo, options = {}) {
		return await this.safeCall(async (octokit) => {
			const { data } = await octokit.rest.issues.listForRepo({
				owner,
				repo,
				state: options.state || 'open',
				sort: options.sort || 'created',
				direction: options.direction || 'desc',
				...options
			});
			return data;
		});
	},

	/**
	 * 获取单个 Issue
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {number} issueNumber - Issue 编号
	 * @returns {Promise<Object>} Issue 对象
	 */
	async getIssue(owner, repo, issueNumber) {
		return await this.safeCall(async (octokit) => {
			const { data } = await octokit.rest.issues.get({
				owner,
				repo,
				issue_number: issueNumber
			});
			return data;
		});
	},

	/**
	 * 创建 Issue
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {Object} issue - Issue 数据 (title, body, labels等)
	 * @returns {Promise<Object>} 创建的 Issue
	 */
	async createIssue(owner, repo, issue) {
		return await this.safeCall(async (octokit) => {
			try {
				let response;
				try {
					response = await octokit.rest.issues.create({
						owner,
						repo,
						...issue
					});
				} catch (createError) {
					// 如果创建时直接抛出错误，记录详细信息
					console.error('❌ [createIssue] octokit.rest.issues.create 直接抛出错误:', {
						errorType: createError.constructor.name,
						message: createError.message,
						status: createError.status,
						response: createError.response,
						responseStatus: createError.response?.status,
						responseData: createError.response?.data,
						responseHeaders: createError.response?.headers,
						request: createError.request,
						allKeys: Object.keys(createError),
						allProperties: Object.getOwnPropertyNames(createError)
					});

					// 尝试获取完整的错误信息
					if (createError.response?.data) {
						console.error('❌ [createIssue] GitHub API 错误详情:', {
							message: createError.response.data.message,
							documentation_url: createError.response.data.documentation_url,
							errors: createError.response.data.errors
						});
					}

					// 重新抛出，让外层 catch 处理
					throw createError;
				}

				// 检查：如果响应对象存在但没有 data，可能是错误情况
				// 从网络日志看到 403，但代码执行到这里，说明异常没有被抛出
				// 我们需要主动检查并抛出错误
				if (!response || !response.data) {
					console.error('❌ [createIssue] 检测到无效响应 - 可能是 403 错误导致 Octokit 返回 undefined');
					console.error('❌ [createIssue] 尝试从网络请求中获取错误信息...');

					// 尝试通过检查网络请求状态来获取错误信息
					// 注意：这里我们无法直接访问网络响应，但可以构造一个合理的错误对象
					const httpError = new Error('创建 Issue 失败：权限不足（403 Forbidden）。请检查：1) 您是否有权限在该仓库创建 Issue；2) Issues 功能是否已启用；3) 您的 API Token 是否具有足够的权限。');
					httpError.status = 403;
					httpError.repositoryOwner = owner;
					httpError.repositoryName = repo;
					httpError.response = response;
					httpError.originalMessage = 'HTTP 403 Forbidden - 无法创建 Issue';
					throw httpError;
				}

				// 先检查响应状态码（虽然成功时通常是 200/201）
				const statusCode = response?.status || response?.statusCode;
				if (statusCode && statusCode >= 400) {
					console.error('❌ [createIssue] 响应状态码异常:', statusCode);
					const error = new Error(`创建 Issue 失败：HTTP ${statusCode}`);
					error.status = statusCode;
					error.response = response;
					throw error;
				}

				// 确保返回的数据存在
				if (!response || !response.data) {
					console.error('❌ [createIssue] 响应数据为空:', {
						hasResponse: !!response,
						hasData: !!response?.data,
						responseKeys: response ? Object.keys(response) : []
					});
					throw new Error('创建 Issue 失败：API 返回了无效的响应');
				}

				return response.data;
			} catch (error) {
				// 详细记录错误对象的所有属性
				console.error('❌ [createIssue] 捕获到错误:', {
					errorType: error.constructor.name,
					message: error.message,
					status: error.status,
					code: error.code,
					name: error.name,
					response: error.response,
					responseStatus: error.response?.status,
					responseStatusCode: error.response?.statusCode,
					responseData: error.response?.data,
					responseHeaders: error.response?.headers,
					request: error.request,
					documentation_url: error.response?.data?.documentation_url,
					errors: error.response?.data?.errors,
					// 记录错误对象的所有可枚举属性
					allKeys: Object.keys(error),
					stack: error.stack?.split('\n').slice(0, 10).join('\n')
				});

				// 确保状态码信息被正确保留（支持多种错误格式）
				// Octokit 的错误可能在不同位置存储状态码
				const statusCode = error.status ||
					error.response?.status ||
					error.response?.statusCode ||
					error.code ||  // 某些情况下错误码可能是 HTTP 状态码
					(error.response?.data?.status); // 有时状态码在 data 中

				if (statusCode) {
					// 为错误添加详细信息，便于调用者处理
					error.status = statusCode;
					error.repositoryOwner = owner;
					error.repositoryName = repo;
					error.originalMessage = error.response?.data?.message || error.message;

					// 针对常见的错误状态码，提供更具体的错误信息
					if (statusCode === 403) {
						const enhancedError = new Error('创建 Issue 失败：权限不足。请确保目标仓库已启用 Issues 功能，且您有访问权限。');
						enhancedError.status = 403;
						enhancedError.repositoryOwner = owner;
						enhancedError.repositoryName = repo;
						enhancedError.originalMessage = error.response?.data?.message || error.message;
						enhancedError.response = error.response;
						enhancedError.details = {
							apiMessage: error.response?.data?.message,
							documentation: error.response?.data?.documentation_url,
							errors: error.response?.data?.errors
						};
						throw enhancedError;
					} else if (statusCode === 404) {
						const enhancedError = new Error('创建 Issue 失败：目标仓库不存在或无法访问。');
						enhancedError.status = 404;
						enhancedError.repositoryOwner = owner;
						enhancedError.repositoryName = repo;
						enhancedError.originalMessage = error.response?.data?.message || error.message;
						enhancedError.response = error.response;
						throw enhancedError;
					}
				}

				// 直接抛出错误，让调用者根据状态码处理
				throw error;
			}
		});
	},

	// ========== Repositories API ==========

	/**
	 * 获取仓库信息
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<Object>} 仓库信息
	 */
	async getRepo(owner, repo) {
		return await this.safeCall(async (octokit) => {
			const { data } = await octokit.rest.repos.get({
				owner,
				repo
			});
			return data;
		});
	},

	/**
	 * 获取仓库文件内容
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {string} path - 文件路径
	 * @returns {Promise<Object>} 文件内容
	 */
	async getRepoContent(owner, repo, path) {
		return await this.safeCall(async (octokit) => {
			const { data } = await octokit.rest.repos.getContent({
				owner,
				repo,
				path
			});
			return data;
		});
	},

	/**
	 * 检查用户是否已为仓库加星
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<boolean>} 是否已加星
	 */
	async isStarred(owner, repo) {
		try {
			// 直接调用 API，404 是正常情况（表示未加星）
			await this._octokit.rest.activity.checkRepoIsStarredByAuthenticatedUser({
				owner,
				repo
			});

			// 如果没有抛出异常，说明已加星（返回 204）
			return true;
		} catch (error) {
			// 404 表示未加星，这是正常情况
			if (error.status === 404) {
				return false;
			}
			// 其他错误也返回 false，避免阻塞页面显示
			console.warn('检查加星状态时出错:', error);
			return false;
		}
	},

	/**
	 * 为仓库加星
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<void>}
	 */
	async starRepo(owner, repo) {
		return await this.safeCall(async (octokit) => {
			await octokit.rest.activity.starRepoForAuthenticatedUser({
				owner,
				repo
			});
		});
	},

	/**
	 * 获取已认证用户的信息
	 * @returns {Promise<Object>} 用户信息
	 */
	async getAuthenticatedUser() {
		return await this.safeCall(async () => {
			const { data } = await this._octokit.rest.users.getAuthenticated();
			return data;
		});
	},

	/**
	 * 执行自定义 API 请求
	 * @param {string} method - HTTP 方法
	 * @param {string} endpoint - API 端点
	 * @param {Object} options - 请求选项
	 * @returns {Promise<Object>} 响应数据
	 */
	async request(method, endpoint, options = {}) {
		return await this.safeCall(async () => {
			const { data } = await this._octokit.request(`${method} ${endpoint}`, options);
			return data;
		});
	}
};

