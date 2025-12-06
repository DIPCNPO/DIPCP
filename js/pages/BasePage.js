/**
 * 基础页面组件
 * 所有页面组件的基类
 */
class BasePage extends Component {
	constructor(props = {}) {
		super(props);
		this.checkInterval = null;
	}

	/**
	 * 挂载组件到DOM
	 * @param {HTMLElement} container - 挂载容器
	 * @param {any} path - 路径参数（可选）
	 */
	mount(container, path = null) {
		super.mount(container);

		// 应用主题
		if (window.ThemeService) {
			window.ThemeService.applyTheme();
		}

		// 应用国际化
		if (window.I18nService) {
			window.I18nService.translatePage();
		}

		this._bindHeaderEvents();
	}

	/**
	 * 处理未读Issues，在Header组件中显示未读Issues数量
	 */
	handleIssues() {
		if (this.headerComponent && this.headerComponent.updateNavigationButtons) {
			this.headerComponent.updateNavigationButtons();
		}
	}

	/** 
	 * 辅助方法：获取i18n文本，如果服务不可用则返回默认值
	 * @param {string} key - 文本键
	 * @param {string} defaultValue - 默认文本
	 * @returns {string} 文本
	 */
	t(key, defaultValue = '') {
		let text = defaultValue;
		if (window.I18nService && window.I18nService.t) {
			text = window.I18nService.t(key, defaultValue);
		}
		return text;
	}

	/**
	 * 获取i18n文本用于HTML属性（placeholder、value等）
	 * @param {string} key - 文本键
	 * @param {string} defaultValue - 默认文本
	 * @returns {string} 文本
	 */
	tAttr(key, defaultValue = '') {
		let text = defaultValue;
		if (window.I18nService && window.I18nService.t) {
			text = window.I18nService.t(key, defaultValue);
		}
		// 使用属性转义（实际上和escapeHtml一样，但语义更清晰）
		return this.escapeHtmlAttribute(text);
	}

	/**
	* 渲染Header组件
	* @returns {string} Header组件的HTML字符串
	*/
	renderHeader() {
		this.headerComponent = new window.Header();
		const headerElement = this.headerComponent.render();
		return headerElement.outerHTML;
	}

	/**
	 * 绑定Header组件的事件
	 */
	_bindHeaderEvents() {
		if (this.headerComponent && this.element) {
			const headerElement = this.element.querySelector('header');
			if (headerElement) {
				this.headerComponent.element = headerElement;

				// 保存原始的 updateNavigationButtons 方法
				if (this.headerComponent.updateNavigationButtons) {
					const originalUpdateNavigationButtons = this.headerComponent.updateNavigationButtons.bind(this.headerComponent);

					// 覆盖 updateNavigationButtons 方法，在更新后自动应用权限控制
					this.headerComponent.updateNavigationButtons = () => {
						originalUpdateNavigationButtons();
					};
				}

				// 绑定事件（如果方法存在）
				if (this.headerComponent.bindEvents) {
					this.headerComponent.bindEvents();
				}
			}
		}
	}

	/**
	 * 显示CLA协议
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 * @param {Function} onSuccess - 签署成功回调
	 * @param {Function} [onCancel] - 取消回调
	 * @returns {Promise<void>}
	 */
	async showCLAAgreement(repoInfo, onSuccess, onCancel) {
		try {
			// 根据语言加载CLA协议内容
			const claContent = await this._loadCLAContent();

			const modal = new window.Modal();
			modal.state.show = true;
			modal.state.type = 'cla';
			modal.state.title = this.t('cla.title', '贡献者许可协议');
			modal.state.message = this.t('cla.content');
			modal.state.claContent = claContent;
			modal.state.inputLabel = this.t('cla.realNameLabel', '请输入您的真实姓名');
			modal.state.inputPlaceholder = this.t('cla.realNamePlaceholder', '请输入您的真实姓名（用于法律文件）');
			modal.state.confirmText = this.t('cla.agree', '同意并签署');
			modal.state.cancelText = this.t('cla.disagree', '不同意');

			const modalElement = modal.render();
			modal.element = modalElement;
			document.body.appendChild(modalElement);
			modal.bindEvents();

			// 等待用户选择
			return new Promise((resolve, reject) => {
				modal.onConfirm = async (realName) => {
					if (!realName || realName.trim() === '') {
						alert(this.t('cla.errors.noRealName', '请输入您的真实姓名'));
						return;
					}

					// 设置处理中状态：禁用按钮，改变按钮文字，改变光标
					modal.setProcessing(true);

					try {
						await this._signCLA(repoInfo, realName.trim());
						if (onSuccess) {
							await onSuccess();
						}
						// 所有异步操作完成后，手动隐藏模态框
						modal.hide();
						resolve();
					} catch (error) {
						console.error('❌ [showCLAAgreement] onConfirm 内部错误:', error);
						// 出错时恢复按钮状态，然后隐藏模态框
						modal.setProcessing(false);
						modal.hide();
						reject(error);
					}
				};

				modal.onCancel = async () => {
					try {
						if (onCancel) {
							await onCancel();
						}
						// 取消时隐藏模态框
						modal.hide();
						resolve();
					} catch (error) {
						console.error('❌ [showCLAAgreement] onCancel 内部错误:', error);
						modal.hide();
						reject(error);
					}
				};
			});
		} catch (error) {
			console.error('加载CLA协议内容失败:', error);
		}
	}

	/**
	 * 加载CLA协议内容
	 * @async
	 * @returns {Promise<string>} CLA协议内容
	 */
	async _loadCLAContent() {
		const currentLanguage = window.app.setting.language.split('-')[0];

		// 根据语言选择CLA文件
		let claFileName = 'CLA_' + currentLanguage + '.md';
		try {
			// 从服务器加载CLA文件（使用app.getFullPath处理基础路径）
			const filePath = window.app.getFullPath(`/docs/${claFileName}`);
			const response = await fetch(filePath);
			if (response.ok) {
				const content = await response.text();
				return content.replace(/\[PROJECT_NAME\]/g, 'DIPCP');
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (error) {
			console.warn(`无法加载CLA文件 ${claFileName}:`, error);
			throw error;
		}
	}

	/**
	 * 签署CLA协议（通过Issue提交）
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 * @param {string} realName - 用户真实姓名
	 * @param {Object} userInfo - 用户信息
	 * @returns {Promise<Object>} 更新后的用户信息
	 */
	async _signCLA(repoInfo, realName) {
		try {
			// 获取当前语言和CLA内容
			const currentLanguage = window.app.setting.language;
			const claContent = await this._loadCLAContent();
			const signTime = new Date().toLocaleString(currentLanguage);

			// 创建完整的CLA文件内容（使用i18n）
			const completeCLAContent = `# ${this.t('cla.signingRecord', 'CLA签署记录')}

**${this.t('cla.signer', '签署者')}：** ${realName} (GitHub: ${window.app.user.username})  
**${this.t('cla.signingTime', '签署时间')}：** ${signTime}  

---

## ${this.t('cla.agreementContent', 'CLA协议内容')}

${claContent}

---

## ${this.t('cla.signingConfirmation', '签署确认')}

${this.t('cla.signingStatement', '我确认已阅读并同意上述贡献者许可协议的所有条款。')}

**${this.t('cla.signerRealName', '签署者真实姓名')}：** ${realName}  
**${this.t('cla.githubUsername', 'GitHub用户名')}：** ${window.app.user.username}  
**${this.t('cla.signingTime', '签署时间')}：** ${signTime}  
**${this.t('cla.email', '邮箱')}：** ${window.app.user.email}

---

*${this.t('cla.autoGenerated', '此文件由DIPCP系统自动生成')}*
			`;

			// 创建CLA提交Issue内容，需要添加工作流提取所需的字段
			const issueTitle = `CLA Submission - ${window.app.user.username}`;
			const issueBody = `${completeCLAContent}

---

**repository:** ${repoInfo ? JSON.stringify(repoInfo) : ''}

			`;

			// 使用GitHub API创建CLA提交Issue
			await window.GitHubService.createIssue(
				'DIPCNPO',
				'creations',
				{
					title: issueTitle,
					body: issueBody
				}
			);

			// 更新用户信息，标记已提交CLA
			window.app.user.CLA = true;

			// 保存更新后的用户信息
			await window.StorageService.saveKV('user', window.app.user);

			console.log('✅ [signCLA] CLA协议提交完成');

		} catch (error) {
			console.error('❌ [signCLA] CLA协议提交失败:', error);
			throw new Error(`CLA协议提交失败: ${error.message}`);
		}
	}

	/**
	 * 添加到作品列表
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 */
	async _addToList(repoInfo) {
		try {
			// 创建添加到作品列表Issue内容
			const issueTitle = `AddtoList - ${window.app.user.username}`;
			const issueBody = `**repository:** ${repoInfo ? JSON.stringify(repoInfo) : ''}`;

			// 使用GitHub API创建添加到作品列表Issue
			await window.GitHubService.createIssue(
				'DIPCNPO',
				'creations',
				{
					title: issueTitle,
					body: issueBody
				}
			);

			console.log('✅ [addToList] 添加到作品列表完成');

		} catch (error) {
			console.error('❌ [addToList] 添加到作品列表失败:', error);
			throw new Error(`添加到作品列表失败: ${error.message}`);
		}
	}

	/**
	 * 获取文件的SHA值（用于更新文件）
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {string} path - 文件路径
	 * @returns {Promise<string|null>} 文件的SHA值，如果文件不存在返回null
	 */
	async getFileSha(owner, repo, path) {
		try {
			const content = await window.GitHubService.getRepoContent(owner, repo, path);
			return content.sha;
		} catch (error) {
			// 如果文件不存在，返回null
			if (error.status === 404 || (error.response && error.response.status === 404)) {
				return null;
			}
			throw error;
		}
	}

	/**
	 * 解析GitHub URL
	 * @param {string} url - GitHub URL
	 * @returns {Object|null} 解析结果
	 */
	parseGitHubUrl(url) {
		const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
		if (match) {
			return {
				owner: match[1],
				repo: match[2].replace(/\.git$/, '')
			};
		}
		return null;
	}

	/**
	 * 创建仓库
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 * @param {boolean} isRoot - 是否是根仓库
	 */
	async createRepository(repoInfo, isRoot = false) {
		try {
			// 1. 创建仓库（设置 auto_init: false，我们自己创建初始提交）
			const repo = await window.GitHubService.safeCall(async (octokit) => {
				try {
					const response = await octokit.rest.repos.createForAuthenticatedUser({
						name: repoInfo.repo,
						description: repoInfo.description,
						private: false,
						auto_init: false, // 重要：设置为 false，我们自己创建初始提交
						has_issues: true  // 启用 Issues 功能
					});
					return response.data;
				} catch (apiError) {
					// 将API错误包装并重新抛出，保留原始错误信息
					const wrappedError = new Error(apiError.message || '创建仓库失败');
					wrappedError.status = apiError.status;
					wrappedError.response = apiError.response;
					throw wrappedError;
				}
			});

			// 检查返回值是否有效
			if (!repo || !repo.owner) {
				throw new Error('创建仓库失败：未返回有效的仓库信息');
			}

			const owner = repo.owner.login;

			// 2. 创建初始提交（包含 DIPCP.md）
			const dipcpContent = `# [${repoInfo.name}](${repoInfo.repository})\n\n${repoInfo.description}`;

			await window.GitHubService.safeCall(async (octokit) => {
				await octokit.rest.repos.createOrUpdateFileContents({
					owner,
					repo: repoInfo.repo,
					path: 'DIPCP.md',
					message: 'DIPCP',
					content: btoa(unescape(encodeURIComponent(dipcpContent)))
				});
			});
			console.log('✅ 初始提交完成');

			// 3. 批量文件
			await this._setupInitialFiles(owner, repoInfo, isRoot);
			if (isRoot) {
				await this._setupActionsPermissions(owner, repoInfo.repo);
				await this._setupWorkflowPermissions(owner, repoInfo.repo);
				await this._setupSecrets(owner, repoInfo.repo);
			}

		} catch (error) {
			// 处理422错误（通常是仓库名称已存在或参数无效）
			if (error.status === 422) {
				// 检查错误详细信息
				let errorMessage = this.t('repositorySelection.errors.repoExists', '仓库名称已存在');

				if (error.response && error.response.data && error.response.data.errors) {
					const errors = error.response.data.errors;
					// 查找是否有更具体的错误信息
					for (const err of errors) {
						if (err.message) {
							errorMessage = err.message;
							break;
						}
					}
				} else if (error.message && error.message.includes('already exists')) {
					errorMessage = this.t('repositorySelection.errors.repoExists', '仓库名称已存在');
				}

				throw new Error(errorMessage);
			}

			// 处理403错误（权限不足）
			if (error.status === 403) {
				throw new Error(this.t('common.errors.noPermission', '没有权限创建仓库，请检查您的GitHub token权限'));
			}

			// 处理其他错误
			throw error;
		}
	}

	/**
	 * 批量创建所有初始文件（一次性提交）
	 * 包括：README.md文件、LICENSE和CONTRIBUTING文件、GitHub Actions工作流
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {Object} repoInfo - 仓库信息
	 * @param {boolean} isRoot - 是否是根仓库
	 */
	async _setupInitialFiles(owner, repoInfo, isRoot) {
		console.log('正在准备批量创建初始文件...');
		const language = window.app.setting.language.split('-')[0];
		const allFiles = [];
		const createTime = new Date().toISOString();

		if (isRoot) {
			allFiles.push({
				path: 'README.md',
				content: repoInfo.description
			});
			// 根仓库才有投票工作流
			const content = await this._loadFile('workflow/vote_workflow.yml');
			allFiles.push({
				path: '.github/workflows/vote_workflow.yml',
				content: content
			});
			// 根仓库才有投票记录
			const json = `{"last_commit":1,"authors":["${owner}"],"readers":[],"likes":0,"hates":0,"pass":0,"daily_voting":0,"articles":[{"path":"${owner}/${repoInfo.repo}/README.md","voting":[],"likes":0,"hates":0,"pass":0}]}`;
			allFiles.push({
				path: '.voting.json',
				content: json
			});
		}

		// 添加索引文件
		allFiles.push({
			path: `story/index.md`,
			content: `pen_name:${repoInfo.penName}\nversion:1\nupdate_time:${createTime}\ncreate_time:${createTime}\n${this.t('common.index')}`
		});

		const files = [
			`docs/ABOUT_${language}.md`,
			`docs/CLA_${language}.md`,
			`docs/LICENSE_${language}.md`,
			`docs/CONTRIBUTING_${language}.md`,
			`docs/White_Paper_${language}_V2.1.md`
		];

		const paths = [
			'ABOUT.md',
			'CLA.md',
			'LICENSE.md',
			'CONTRIBUTING.md',
			'White_Paper_V2.1.md'
		];

		// 加载所有工作流文件内容
		for (let i = 0; i < files.length; i++) {
			const content = await this._loadFile(files[i]);
			allFiles.push({
				path: paths[i],
				content: content
			});
		}

		// 批量创建所有文件（一次性提交）
		try {
			await this._batchCreateOrUpdateFiles(
				owner,
				repoInfo.repo,
				allFiles,
				''
			);
			console.log(`✅ 成功批量创建 ${allFiles.length} 个初始文件`);
		} catch (error) {
			console.error('❌ 批量创建初始文件失败:', error);
			throw error;
		}
	}

	/**
	 * 加载文件模板
	 * @async
	 * @param {string} path - 模板文件路径
	 * @returns {Promise<string>} 模板文件内容
	 * @throws {Error} 如果文件加载失败
	 */
	async _loadFile(path) {
		// 从服务器加载文件（使用app.getFullPath处理基础路径）
		const filePath = window.app.getFullPath(`/${path}`);
		const response = await fetch(filePath);
		if (response.ok) {
			return await response.text();
		} else {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
	}

	/**
	 * 批量创建或更新文件（一次性提交）
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名
	 * @param {Array} files - 文件数组，每个元素包含 {path, content}
	 * @param {string} message - 提交消息
	 */
	async _batchCreateOrUpdateFiles(owner, repo, files, message) {
		if (!files || files.length === 0) {
			throw new Error('文件列表不能为空');
		}

		try {
			// 由于已经有了初始提交，可以直接使用 Git Data API 批量添加所有文件
			// 这样可以减少 API 调用次数
			await this._createBatchCommit(owner, repo, files, message);
			return 'created';
		} catch (error) {
			console.error('❌ [_batchCreateOrUpdateFiles] 批量创建文件失败:', error);
			throw error;
		}
	}

	/**
	 * 使用git操作批量创建提交
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {Array} files - 文件数组，每个元素包含 {path, content}
	 * @param {string} message - 提交消息（可选）
	 */
	async _createBatchCommit(owner, repo, files, message = '') {
		try {
			// 1. 获取当前用户信息
			const author = {
				name: owner,
				email: window.app.user.email,
				date: new Date().toISOString()
			};

			// 2. 获取最新的提交SHA
			const refData = await window.GitHubService.safeCall(async (octokit) => {
				try {
					const response = await octokit.rest.git.getRef({
						owner,
						repo,
						ref: 'heads/main'
					});
					if (!response || !response.data) {
						throw new Error('获取分支引用失败：返回数据为空');
					}
					return response.data;
				} catch (error) {
					// 如果 main 分支不存在，尝试获取默认分支
					if (error.status === 404) {
						const repoInfo = await octokit.rest.repos.get({
							owner,
							repo
						});
						const defaultBranch = repoInfo.data.default_branch || 'main';
						const response = await octokit.rest.git.getRef({
							owner,
							repo,
							ref: `heads/${defaultBranch}`
						});
						if (!response || !response.data) {
							throw new Error(`获取默认分支 ${defaultBranch} 引用失败：返回数据为空`);
						}
						return response.data;
					}
					throw error;
				}
			});

			if (!refData || !refData.object || !refData.object.sha) {
				throw new Error('获取分支引用失败：引用数据无效');
			}
			const baseTreeSHA = refData.object.sha;

			// 3. 获取基础tree的SHA
			const commitData = await window.GitHubService.safeCall(async (octokit) => {
				const response = await octokit.rest.git.getCommit({
					owner,
					repo,
					commit_sha: baseTreeSHA
				});
				if (!response || !response.data) {
					throw new Error('获取提交数据失败：返回数据为空');
				}
				return response.data;
			});

			if (!commitData || !commitData.tree || !commitData.tree.sha) {
				throw new Error('获取提交数据失败：提交数据无效');
			}
			const treeSha = commitData.tree.sha;

			// 4. 为每个文件创建blob
			const treeItems = await Promise.all(files.map(async (file) => {
				const isBase64 = typeof file.content === 'string' &&
					file.content.length > 0 &&
					/^[A-Za-z0-9+/=]+$/.test(file.content) &&
					file.content.length % 4 === 0;

				const blobContent = isBase64
					? file.content
					: btoa(unescape(encodeURIComponent(file.content)));

				const blobData = await window.GitHubService.safeCall(async (octokit) => {
					const response = await octokit.rest.git.createBlob({
						owner,
						repo,
						content: blobContent,
						encoding: 'base64'
					});
					if (!response || !response.data) {
						throw new Error('创建 blob 失败：返回数据为空');
					}
					return response.data;
				});

				return {
					path: file.path,
					mode: '100644',
					type: 'blob',
					sha: blobData.sha
				};
			}));

			// 5. 创建新的tree
			const treeData = await window.GitHubService.safeCall(async (octokit) => {
				const response = await octokit.rest.git.createTree({
					owner,
					repo,
					base_tree: treeSha,
					tree: treeItems
				});
				if (!response || !response.data) {
					throw new Error('创建 tree 失败：返回数据为空');
				}
				return response.data;
			});

			// 6. 创建新的commit
			// 确保提交消息不为空
			const commitMessage = (message && message.trim()) ? message.trim() : `批量提交文件: ${files.map(f => f.path.split('/').pop()).join(', ')}`;
			const commit = await window.GitHubService.safeCall(async (octokit) => {
				const response = await octokit.rest.git.createCommit({
					owner,
					repo,
					message: commitMessage,
					tree: treeData.sha,
					parents: [baseTreeSHA],
					author: author,
					committer: author
				});
				if (!response || !response.data) {
					throw new Error('创建提交失败：返回数据为空');
				}
				return response.data;
			});

			// 7. 直接更新 main 分支引用（自己的仓库，有权限）
			// 由于只有所有者一个用户，直接使用 force 更新以避免 fast forward 错误
			await window.GitHubService.safeCall(async (octokit) => {
				await octokit.rest.git.updateRef({
					owner,
					repo,
					ref: 'heads/main',
					sha: commit.sha,
					force: true  // 自己的仓库，直接使用 force 更新
				});
			});
			console.log('✅ 更新 main 分支成功');
		} catch (error) {
			console.error('❌ [_createBatchCommit] 直接提交失败:', error);
			throw error;
		}
	}

	/**
	 * 设置Actions权限
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 */
	async _setupActionsPermissions(owner, repo) {
		await window.GitHubService.safeCall(async (octokit) => {
			try {
				const result = await octokit.rest.actions.setGithubActionsPermissionsRepository({
					owner,
					repo,
					enabled: true,
					allowed_actions: 'all'
				});
				return result;
			} catch (apiError) {
				console.error('❌ [setupActionsPermissions] API调用失败:', {
					status: apiError.status,
					message: apiError.message,
					response: apiError.response?.data
				});
				throw apiError;
			}
		});
		// 如果没有抛出错误，说明设置成功
		console.log('✅ [setupActionsPermissions] Actions权限设置完成');
	}

	/**
	 * 设置Workflow权限
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 */
	async _setupWorkflowPermissions(owner, repo) {
		try {
			// 先获取当前权限设置
			const currentActionsPermissions = await window.GitHubService.safeCall(async (octokit) => {
				const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/permissions', {
					owner, repo
				});
				return data;
			});

			const currentWorkflowPermissions = await window.GitHubService.safeCall(async (octokit) => {
				const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/permissions/workflow', {
					owner, repo
				});
				return data;
			});

			// 检查第一个权限（Actions）是否已正确设置
			const isActionsCorrectlySet = currentActionsPermissions.enabled && currentActionsPermissions.allowed_actions === 'all';

			if (!isActionsCorrectlySet) {
				// 设置Actions权限
				const actionsPermissions = {
					owner, repo,
					enabled: true,
					allowed_actions: 'all'
				};
				await window.GitHubService.safeCall(async (octokit) => {
					await octokit.request('PUT /repos/{owner}/{repo}/actions/permissions', actionsPermissions);
				});

				// 设置Workflow权限
				const workflowPermissions = {
					owner, repo,
					default_workflow_permissions: 'write',
					can_approve_pull_request_reviews: true
				};
				await window.GitHubService.safeCall(async (octokit) => {
					await octokit.request('PUT /repos/{owner}/{repo}/actions/permissions/workflow', workflowPermissions);
				});
			}

		} catch (error) {
			console.error('❌ Workflow权限设置失败:', error);
			throw error;
		}
	}

	/**
	 * 创建GitHub Secrets
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 */
	async _setupSecrets(owner, repo) {
		try {
			// 获取公钥
			const publicKeyData = await window.GitHubService.safeCall(async (octokit) => {
				const { data } = await octokit.rest.actions.getRepoPublicKey({
					owner, repo
				});
				return data;
			});

			// 创建COLLABORATOR_TOKEN secret
			const secretValue = window.app.user.token;

			// 使用Web Crypto API进行正确的加密
			const encryptedValue = await this._encryptSecret(secretValue, publicKeyData.key);

			await window.GitHubService.safeCall(async (octokit) => {
				await octokit.rest.actions.createOrUpdateRepoSecret({
					owner, repo,
					secret_name: 'COLLABORATOR_TOKEN',
					encrypted_value: encryptedValue,
					key_id: publicKeyData.key_id
				});
			});

		} catch (error) {
			console.error('❌ Secrets创建失败:', error);
		}
	}

	/**
	 * 使用公钥加密密钥值
	 * @async
	 * @param {string} secretValue - 需要加密的密钥值
	 * @param {string} publicKey - 公钥
	 * @returns {Promise<string>} 加密后的密钥值
	 */
	async _encryptSecret(secretValue, publicKey) {
		try {
			// 检查是否有libsodium库
			if (typeof window.sodium !== 'undefined') {
				await window.sodium.ready;

				// 使用标准的atob解码base64，而不是sodium.from_base64
				const keyBytes = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
				const messageBytes = new TextEncoder().encode(secretValue);
				const encryptedBytes = window.sodium.crypto_box_seal(messageBytes, keyBytes);
				// 使用标准的btoa编码，而不是sodium.to_base64
				const encryptedBase64 = btoa(String.fromCharCode(...encryptedBytes));

				return encryptedBase64;
			} else {
				throw new Error(this.t('login.errors.libsodiumNotLoaded', 'libsodium库未加载'));
			}
		} catch (error) {
			console.error('❌ libsodium加密失败:', error);
		}
	}

	/**
	 * 渲染文章内容
	 * @param {string} content - 文章内容
	 * @returns {string} 文章内容HTML字符串
	 */
	_renderArticleContent(content) {
		// 判断是否显示作者留言
		if (!window.app.setting.show_message) {
			const index = content.indexOf('-*-*-');
			if (index !== -1) {
				content = content.substring(0, index);
			}
		} else {
			content = content.replace('-*-*-', `<br>\n* **${this.t('viewPage.authorMessage', '作者留言')}:**`);
		}

		// 转换为HTML
		let html = this.markdownToHtml(content);

		// 如果转换后为空，使用原始内容（可能是纯文本）
		if (!html && content) {
			html = this.escapeHtml(content).replace(/\n/g, '<br>');
		}

		// 处理链接跳转
		html = this.processLinks(html);

		// 处理媒体文件
		html = this.processMedia(html);

		return `<div class="article-content" data-scroll-top="${this.state?.article?.scrollTop || 0}">${html || ''}</div>`;
	}

	/**
	 * 处理Markdown中的链接，使其可点击跳转
	 * @param {string} html - HTML内容
	 * @returns {string} 处理后的HTML
	 */
	processLinks(html) {
		if (!html) return '';

		// 创建临时DOM来解析HTML
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = html;

		// 处理所有链接
		const links = tempDiv.querySelectorAll('a[href]');
		links.forEach(link => {
			let originalHref = link.getAttribute('href') || '';

			// 忽略以 http/https 开头的外链，直接返回
			if (originalHref.startsWith('http://') || originalHref.startsWith('https://')) {
				link.removeAttribute('href'); // 防止浏览器默认跳转
				return;
			}
			// 如果是LICENSE.md，则添加当前仓库信息
			if (originalHref.endsWith('LICENSE.md')) {
				originalHref = `${window.app.setting.current_repo}/LICENSE.md`;
			}

			// 只处理仓库内的 Markdown文件
			if (originalHref.endsWith('.md')) {
				link.setAttribute('data-article-link', originalHref);
				link.classList.add('article-link');
				link.style.cursor = 'pointer';
				link.removeAttribute('href'); // 防止浏览器默认跳转
				link.setAttribute('role', 'button');
				link.setAttribute('tabindex', '0');
			}
		});

		return tempDiv.innerHTML;
	}

	/**
	 * 处理媒体文件（图片和音频）
	 * 将图片从 <p> 标签中分离出来，并标记需要从数据库加载
	 * @param {string} html - HTML内容
	 * @returns {string} 处理后的HTML
	 */
	processMedia(html) {
		if (!html) return '';

		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = html;

		// 处理图片 - 标记需要加载的图片，并将图片从 <p> 标签中分离出来
		const images = tempDiv.querySelectorAll('img');
		images.forEach(img => {
			const src = img.getAttribute('src');
			if (src && !src.startsWith('http') && !src.startsWith('data:')) {
				// 相对路径，标记为需要从数据库加载
				img.setAttribute('data-media-src', src);
				// 设置一个占位符，避免浏览器尝试从文件系统加载
				img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
				img.style.maxWidth = '100%';
				img.style.height = 'auto';
				// 添加加载中的样式
				img.style.opacity = '0.3';

				// 如果图片在 <p> 标签内，将其移出 <p> 标签
				const parentP = img.parentElement;
				if (parentP && parentP.tagName === 'P') {
					// 检查 <p> 标签中是否还有其他内容（除了空白文本节点）
					const hasOtherContent = Array.from(parentP.childNodes).some(node => {
						if (node === img) return false;
						if (node.nodeType === Node.TEXT_NODE) {
							return node.textContent.trim().length > 0;
						}
						return true;
					});

					// 如果 <p> 标签中还有其他内容，只移除图片
					// 如果 <p> 标签中只有图片，则整个 <p> 标签替换为图片
					if (hasOtherContent) {
						// 在 <p> 标签后插入图片
						const nextSibling = parentP.nextSibling;
						parentP.parentNode.insertBefore(img, nextSibling);
					} else {
						// 用图片替换整个 <p> 标签
						parentP.parentNode.replaceChild(img, parentP);
					}
				}
			}
		});

		// 处理音频 - 标记需要加载的音频，并将音频从 <p> 标签中分离出来
		const audios = tempDiv.querySelectorAll('audio');
		audios.forEach(audio => {
			const src = audio.getAttribute('src');
			if (src && !src.startsWith('http') && !src.startsWith('data:')) {
				// 相对路径，标记为需要从数据库加载
				audio.setAttribute('data-media-src', src);
				// 清空src，音频元素在没有src时也能正常工作
				audio.removeAttribute('src');

				// 如果音频在 <p> 标签内，将其移出 <p> 标签
				const parentP = audio.parentElement;
				if (parentP && parentP.tagName === 'P') {
					// 检查 <p> 标签中是否还有其他内容
					const hasOtherContent = Array.from(parentP.childNodes).some(node => {
						if (node === audio) return false;
						if (node.nodeType === Node.TEXT_NODE) {
							return node.textContent.trim().length > 0;
						}
						return true;
					});

					if (hasOtherContent) {
						// 在 <p> 标签后插入音频
						const nextSibling = parentP.nextSibling;
						parentP.parentNode.insertBefore(audio, nextSibling);
					} else {
						// 用音频替换整个 <p> 标签
						parentP.parentNode.replaceChild(audio, parentP);
					}
				}
			}
		});

		return tempDiv.innerHTML;
	}

	/**
	 * 加载预览中的媒体文件（图片和音频）
	 * 从数据库中读取媒体文件并显示
	 */
	async loadMediaElements() {
		if (!this.element) {
			console.warn('loadMediaElements: element is null');
			return;
		}

		// 加载图片
		const images = this.element.querySelectorAll('img[data-media-src]');

		for (const img of images) {
			let mediaPath = img.getAttribute('data-media-src');
			if (!mediaPath) continue;

			console.log('🔍 [loadMediaElements] 原始路径:', mediaPath);

			// 解码URL编码的路径（处理中文等特殊字符）
			try {
				mediaPath = decodeURIComponent(mediaPath);
				console.log('🔍 [loadMediaElements] 解码后路径:', mediaPath);
			} catch (e) {
				// 如果解码失败，使用原始路径
				console.warn('loadMediaElements: 路径解码失败，使用原始路径:', mediaPath, e);
			}

			// 检查路径格式
			const parsed = window.app.parsePath(mediaPath);
			console.log('🔍 [loadMediaElements] 路径解析结果:', parsed);

			try {
				// 从数据库获取媒体文件
				console.log('🔍 [loadMediaElements] 开始获取媒体文件:', mediaPath);
				const mediaBlob = await window.StorageService.getMedia(mediaPath);
				console.log('🔍 [loadMediaElements] getMedia 返回结果:', mediaBlob ? 'Blob对象' : 'null', mediaBlob ? `大小: ${mediaBlob.size} bytes, 类型: ${mediaBlob.type}` : '');

				if (mediaBlob) {
					// 创建对象URL并设置为图片src
					const objectUrl = URL.createObjectURL(mediaBlob);
					console.log('🔍 [loadMediaElements] 创建对象URL:', objectUrl);

					// 图片加载成功后再设置src
					const tempImg = new Image();
					tempImg.onload = () => {
						console.log('✅ [loadMediaElements] 图片加载成功:', mediaPath);
						img.src = objectUrl;
						img.style.opacity = '1'; // 恢复透明度
						img.removeAttribute('data-media-src');
					};

					tempImg.onerror = (e) => {
						console.error('❌ [loadMediaElements] 图片加载失败:', mediaPath, e);
						console.error('❌ [loadMediaElements] 对象URL:', objectUrl);
						console.error('❌ [loadMediaElements] Blob信息:', mediaBlob.size, mediaBlob.type);
						URL.revokeObjectURL(objectUrl);
						img.alt = this.t('editorPage.imageLoadError', '图片加载失败');
						img.style.opacity = '1';
					};

					tempImg.src = objectUrl;
				} else {
					console.warn('⚠️ [loadMediaElements] 媒体文件不存在:', mediaPath);
					img.alt = this.t('editorPage.imageNotFound', '图片未找到');
					img.style.opacity = '1';
				}
			} catch (error) {
				console.error('❌ [loadMediaElements] 加载图片异常:', mediaPath, error);
				console.error('❌ [loadMediaElements] 错误堆栈:', error.stack);
				img.alt = this.t('editorPage.imageLoadError', '图片加载失败');
				img.style.opacity = '1';
			}
		}

		// 加载音频
		const audios = this.element.querySelectorAll('audio[data-media-src]');

		for (const audio of audios) {
			let mediaPath = audio.getAttribute('data-media-src');
			if (!mediaPath) continue;

			// 解码URL编码的路径（处理中文等特殊字符）
			try {
				mediaPath = decodeURIComponent(mediaPath);
			} catch (e) {
				// 如果解码失败，使用原始路径
				console.warn('loadMediaElements: 路径解码失败，使用原始路径:', mediaPath, e);
			}

			try {
				// 从数据库获取媒体文件
				const mediaBlob = await window.StorageService.getMedia(mediaPath);
				if (mediaBlob) {
					// 创建对象URL并设置为音频src
					const objectUrl = URL.createObjectURL(mediaBlob);
					audio.src = objectUrl;
					audio.removeAttribute('data-media-src');
				} else {
					console.warn('loadMediaElements: 音频文件不存在:', mediaPath);
				}
			} catch (error) {
				console.error('loadMediaElements: 加载音频失败:', mediaPath, error);
			}
		}
	}

	/**
	 * 处理预览中的链接跳转
	 */
	handlePreviewLink() {
		// 文章链接点击事件
		const articleLinks = this.element.querySelectorAll('.article-link[data-article-link]');
		articleLinks.forEach(link => {
			const handleNavigate = (href) => {
				if (!href) return;
				this.navigateToArticle(href);
			};

			link.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				handleNavigate(e.currentTarget.getAttribute('data-article-link'));
			});
		});
	}

	/**
	 * 停止检查未读通知
	 */
	stopCheckingUnreadIssues() {
		if (this.checkInterval) {
			clearTimeout(this.checkInterval);
			this.checkInterval = null;
		}
	}

	/**
	 * 注销组件
	 */
	destroy() {
		this.stopCheckingUnreadIssues();
		super.destroy();
	}
}

// 注册组件
window.BasePage = BasePage;
