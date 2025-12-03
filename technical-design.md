# DIPCP 技术设计文档

## 0 文档信息

- **项目名称**: DIPCP - Decentralized Intellectual Property Collaboration Platform
- **版本**: v1.2
- **创建日期**: 2025年10月21日
- **最后更新**: 2025年11月15日
- **文档类型**: 技术设计文档

## 1 项目结构

```
DIPCP/
├── index.html                  # 单页应用入口，加载所有JS资源
├── 404.html                    # 重定向专用文件
├── js/                         # JavaScript文件
│   ├── app.js                  # 应用主入口，路由和状态管理
│   ├── loader.js               # js加载器
│   ├── libsodium.js            # 加密库
│   ├── JSZip.js                # 压缩库
│   ├── marker.min.js           # MD格式转换器
│   ├── pages/                  # 页面组件
│   │   ├── LoginPage.js        # 登录页面组件
│   │   ├── CreationsPage.js    # 作品选择页面组件
│   │   ├── EditorPage.js       # 编辑器页面组件
│   │   ├── ViewsPage.js        # 阅读页面组件
│   │   ├── NoticesPage.js      # 通知页面组件
│   │   ├── TermsPage.js        # 服务条款页面组件
│   │   ├── PrivacyPage.js      # 隐私政策页面组件
│   │   └── SettingsPage.js     # 设置页面组件
│   ├── components/             # 通用组件
│   │   ├── Component.js        # 组件基类
│   │   ├── ComponentLoader.js  # 组件加载器
│   │   ├── Modal.js            # 通用模态框组件
│   │   └── Header,js           # 导航按钮组件
│   └── services/               # 服务层
│       ├── github-service.js   # Github API服务
│       ├── storage-service.js  # 数据存储服务
│       ├── i18n-service.js     # 国际化服务
│       └── theme-service.js    # 主题管理服务
├── templates/                  # 模板文件目录
│   └── vote_workflow.yml       # GitHub Actions工作流模板
├── locales/                    # 国际化文件
│   ├── zh-CN.json              # 中文翻译
│   ├── ja-JP.json              # 日语翻译
│   └── en-US.json              # 英文翻译
├── styles/                     # 样式文件
│   ├── main.css                # 主样式文件
│   └── modal.css               # 模态框样式文件
├── docs/                       # 文档目录
│   ├── prd.md                  # 产品需求文档
│   ├── technical-design.md     # 技术设计文档
│   └── ui-design/              # UI设计文档
└── README.md                   # 项目说明
```

## 2 GitHub API类型说明

**REST API** (@octokit/rest.js)
   - **使用场景**: 仓库操作、文件管理、Issues等
   - **特点**: 基于HTTP方法，请求简单直接
   - **示例**: `octokit.rest.repos.get()`, `octokit.rest.issues.create()`

## 3 SPA架构实现

**编码核心原则**：
- **国际化**：页面上所有可见文本必须通过i18n服务提供国际化，调试语句中的内容除外。
- **必须加注释**：所有方法必须采用js标准格式，进行中文注释。

### 3.1 应用初始化流程

#### 3.1.1 资源加载策略

DIPCP采用一次性加载策略，在index.html中集中加载资源。

- **渐进式加载**: 先加载核心服务，再加载其他依赖
- **分组并行**: 按依赖关系分组，组内并行加载
- **避免时序问题**: 通过动态加载器确保加载顺序
- **错误容错**: 加载失败时有友好的错误处理

**技术实现**：
- 使用`<script>`标签动态创建脚本元素
- 使用`Promise.all()`实现组内并行加载
- 使用`waitForServices()`确保依赖就绪

#### 3.1.2 应用启动流程

应用启动遵循严格的初始化顺序，确保所有依赖正确加载。

**启动流程**：
1. **DOM加载完成**: 监听`DOMContentLoaded`事件
2. **外部库加载**: 加载Octokit
3. **服务初始化**: 加载i18n服务和动态加载器
4. **本地库加载**: 加载libsodium、marker、JSZip
5. **应用脚本加载**: 按依赖分组加载所有脚本
6. **应用初始化**: 
   - 等待所有服务就绪
   - 初始化语言设置
   - 检查用户认证状态
   - 初始化路由系统
   - 渲染初始页面
7. **路由处理**: 根据认证状态决定显示哪个页面

### 3.2 路由系统设计

#### 3.2.1 路由管理器

DIPCP采用原生JavaScript，在app.js中实现客户端路由，支持路径匹配、查询参数解析和自动重定向。

**核心功能**：
- **路由注册**: 定义路径与页面类的映射关系
- **路径匹配**: 支持精确匹配和参数匹配
- **认证重定向**: 根据认证状态自动重定向
- **历史记录**: 支持浏览器前进/后退

**认证重定向逻辑**：
Indexeddb中没有user，去LoginPage
user中有令牌，去CreationsPage
setting中有当前页面，去当前页面

**路径匹配**：
- 支持精确匹配：`/login` → `LoginPage`
- 支持在子目录中的匹配：`/DIPCP/editor` → `EditorPage`

**页面渲染流程**：
1. 匹配路由：根据当前URL匹配对应的页面类
2. 检查认证：根据用户权限决定是否重定向
3. 销毁旧页面：调用destroy()清理旧页面
4. 创建新页面：实例化页面类
5. 解析参数：提取查询参数并传递给页面
6. 渲染页面：调用render()方法
7. 挂载DOM：将页面挂载到容器

### 3.3 页面组件设计

#### 3.3.1 页面基类

所有页面组件继承自Component基类，提供生命周期管理和事件处理。

**Component基类功能**：所有组件的基类
**BasePage基类**：所有页面组件继承自BasePage，提供页面级别的功能。

**核心特性**：
- **生命周期管理**: mount、destroy
- **状态管理**: 组件级状态管理
- **事件绑定**: 自动绑定和解绑事件
- **国际化支持**: 自动应用i18n翻译
- **主题支持**: 自动应用当前主题
- **字体支持**: 自动应用当前字体

#### 3.3.2 通用模态框组件设计

DIPCP提供完全可复用的通用模态框组件，支持4种类型：输入、确认、信息、CLA。

**组件特性**：
- **四种类型**: `input`（输入）、`confirm`（确认）、`info`（信息）、`CLA`（协议）
- **键盘支持**: 回车确认、ESC取消
- **遮罩关闭**: 点击遮罩可关闭
- **自动聚焦**: 自动聚焦输入框或按钮
- **主题适配**: 完全支持主题切换
- **国际化**: 完全支持多语言

**技术实现要点**：
- 使用Promise实现异步操作
- 自动管理事件监听器（keyboard、focus、click）
- 使用`data-*`属性标识模态框类型
- 支持国际化字符串注入
- 响应式设计，支持移动端

### 3.4 全局状态管理

在app.js中长期保存user，setting，undo，这三个对象，前两个可以持久化保存，在所有页面中统一使用

### 3.5 数据同步机制

- **数据更新**: 用户每天一次利用Issue提交本地投票数据，并直接下载.voting.zip文件获取更新数据
- **本地缓存**: 使用IndexedDB缓存文件内容
- **冲突处理**: 基于Git的版本控制解决冲突

## 4 核心类库实现

### 4.1 app.js

	/**
	 * 初始化应用程序
	 * 按顺序加载外部库、脚本、服务，然后初始化主题、认证和路由
	 * @async
	 * @returns {Promise<void>}
	 */
	async init() 

	/**
	* 检测应用的基础路径
	* 如果部署在子目录（如 /DIPCP/），则返回该路径，否则返回 '/'
	* 基础路径应该从 index.html 的位置确定，而不是当前页面路径
	* @returns {string} 基础路径
	*/
	detectBasePath()

	/**
	 * 获取相对于基础路径的路径
	 * @param {string} path - 完整路径
	 * @returns {string} 相对于基础路径的路径
	 */
	getRelativePath(path)

	/**
	 * 获取完整路径（包含基础路径）
	 * @param {string} path - 相对路径
	 * @returns {string} 完整路径
	 */
	getFullPath(path) 	

	/**
	 * 等待所有必需的服务加载完成
	 * 检查 I18nService、StorageService 和 Octokit 是否可用
	 * @async
	 * @returns {Promise<void>}
	 */
	async waitForServices()

	/**
	 * 初始化路由系统
	 * 定义所有路由规则，设置事件监听器
	 * @returns {void}
	 */
	initRouter()

	/**
	 * 导航到指定路径
	 * @param {string} path - 目标路径（相对于基础路径）
	 * @returns {void}
	 */
	async navigateTo(path)

	/**
	 * 处理路由变化
	 * 根据用户认证状态决定重定向逻辑，渲染对应页面
	 * @async
	 * @returns {Promise<void>}
	 */
	async handleRouteChange()

	/**
	 * 匹配路由
	 * 根据路径匹配对应的页面类名（使用相对路径）
	 * @param {string} path - 要匹配的路径（应该是相对路径）
	 * @returns {string} 页面类名
	 */
	matchRoute(path)

	/**
	 * 检查路径是否匹配模式
	 * 支持精确匹配和参数匹配
	 * @param {string} pattern - 匹配模式
	 * @param {string} path - 要检查的路径
	 * @returns {boolean} 是否匹配
	 */
	isMatch(pattern, path)

	/**
	 * 渲染页面
	 * 创建页面实例，设置属性，渲染并挂载到DOM
	 * @async
	 * @param {string} pageClass - 页面类名
	 * @param {string} fullPath - 完整路径（包含查询参数）
	 * @returns {Promise<void>}
	 */
	async renderPage(pageClass, fullPath)

	/**
	 * 挂载页面到DOM
	 * 将当前页面组件挂载到应用容器中
	 * @param {string} fullPath - 完整路径
	 * @returns {Promise<void>}
	 */
	async mountPage(fullPath)

	/**
	 * 解析路径
	 * 从路径中提取作者、仓库名、目录路径、文件名、扩展名、完整文件名
	 * @param {string} path - 路径
	 * @returns {Object|null} 包含author、repo、dirPath、filename、extension、fullFilename的对象，解析失败返回null
	 */
	parsePath(path)

	/**
	 * 解析文章内容
	 * @param {string} content - 文章内容
	 * @returns {Object} 解析结果
	 */
	parseArticleContent(content)

### 4.2 loader.js

	/**
	 * 动态加载单个脚本
	 */
	async loadScript(src)

	/**
	 * 动态加载ES模块
	 */
	async loadESModule(src)

	/**
	 * 加载外部库
	 */
	async loadExternalLibraries()

	/**
	 * 批量加载脚本（分组并行加载）
	 */
	async loadScripts(scripts)

	/**
	 * 等待i18n服务完全加载
	 */
	async waitForI18nReady()

	/**
	 * 加载所有应用脚本
	 */
	async loadAllScripts()

### 4.3 i18n-service.js

	/**
	 * 获取语言显示名称
	 * @param {string} languageCode - 语言代码
	 * @returns {string} 语言显示名称
	 */
	getLanguageDisplayName(languageCode)

	/**
	 * 初始化多语言服务
	 */
	async init() 

	/**
	 * 获取翻译文本
	 * @param {string} key - 翻译键，支持点号分隔的嵌套键
	 * @param {object} params - 参数对象，用于替换占位符
	 * @returns {string} 翻译后的文本
	 */
	t(key, params = {})

	/**
	 * 切换语言
	 * @param {string} language - 目标语言代码
	 */
	async changeLanguage(language)

	/**
	 * 获取当前语言
	 * @returns {string} 当前语言代码
	 */
	getCurrentLanguage()

	/**
	 * 获取支持的语言列表
	 * @returns {array} 支持的语言代码数组
	 */
	getSupportedLanguages()

	/**
	 * 批量翻译页面元素
	 * @param {string} selector - CSS选择器，默认为所有带有data-i18n属性的元素
	 */
	translatePage(selector = '[data-i18n]')

	/**
	 * 格式化日期
	 * @param {Date} date - 日期对象
	 * @param {string} format - 格式类型
	 * @returns {string} 格式化后的日期字符串
	 */
	formatDate(date, format = 'default')

	/**
	 * 格式化数字
	 * @param {number} number - 数字
	 * @returns {string} 格式化后的数字字符串
	 */
	formatNumber(number)

### 4.4 storage-service.js
	
	/**
	 * 初始化IndexedDB
	 */
	async initDB()

	/**
	 * 执行IndexedDB操作
	 * @param {string} storeName - 存储名称
	 * @param {string} operation - 操作类型
	 * @param {...any} args - 操作参数
	 */
	async execute(storeName, operation, ...args)
	
	/**
	 * 清空数据库所有表的内容（不删除数据库结构）
	 */
	async clear()

	/**
	 * 保存KV对（值加密）
	 * @param {string} key - 键
	 * @param {Object} value - 值（会被加密）
	 */
	async saveKV(key, value)

	/**
	 * 获取KV值（值解密）
	 * @param {string} key - 键
	 * @returns {Object} 解密后的值，如果不存在返回null
	 */
	async getKV(key)

	/**
	 * 读取文件
	 * @param {string} path - 文件路径
	 * @param {function} callback - 回调函数
	 */
	async readFile(path, callback)

	/**
	 * 保存文件
	 * @param {string} path - 文件路径
	 * @param {string} content - 文件内容
	 */
	async saveFile(path, content)

	/**
	 * 删除文件（自己编写的文件）
	 * @param {string} path - 文件路径
	 */
	async deleteFile(path)
	
	/** 
	 * 获取指定仓库中的所有文件
	 * @param {string} repo - 仓库名
	 * @returns {Promise<Object[]>} 文件列表
	 */
	async getFiles(repo)
	
	/**
	 * 保存待提交文件
	 * @param {string} path - 文件路径
	 */
	async savePendingFile(path)

	/**
	 * 删除待提交文件
	 * @param {string} path - 文件路径
	 */
	async deletePendingFile(path) 

	/**
	 * 获取指定仓库中的所有待提交文件
	 * @param {string} repo - 仓库名
	 * @returns {Promise<Object[]>} 待提交文件列表
	 */
	async getPendingFiles(repo)
	
	/**
	 * 获取媒体文件
	 * @private
	 * @param {string} path - 标准路径
	 * @returns {Promise<Object|null>} 缓存的媒体对象或null
	 */
	async getMedia(path)

	/**
	 * 保存媒体文件
	 * @private
	 * @param {string} path - 路径
	 * @param {Blob} blob - 媒体文件Blob
	 */
	async saveMedia(path, blob)

	/**
	 * 投票
	 * @param {string} path - 标准路径
	 * @param {number} vote - 投票值（-1, 0, 1）
	 */
	async voting(path, vote)

	/**
	 * 获取所有投票结果后清理投票
	 * @returns {Promise<Object[]>} 投票数据
	 */
	async clearVoting()

	/**
	 * 文件下载
	 * @param {string} path - 文件路径
	 * @param {Function} callback - 回调函数，参数为下载的文件对象
	 */
	async downloadFile(path, callback)

	/**
	 * 多线程下载媒体文件
	 * @param {string[]} medias - 媒体文件路径数组
	 * @param {Function} callback - 回调函数，参数为下载的媒体文件对象
	 */
	async downloadMediaFiles(medias, callback)

	/**
	 * 翻译文件
	 * @param {Object} fileData - 文件对象
	 * @param {Function} callback - 回调函数，参数为翻译结果
	 */
	async translateFile(fileData, callback)

	/** 
	 * 批量下载文件，下载之前先检查本地是否存在，支持多线程
	 * @param {string[]} paths - 文件路径数组
	 */
	async downloadFiles(paths)

	/**
	 * 解析文章中的图像和音频链接
	 * @param {string} content - 文章内容
	 * @returns {string[]} 媒体文件URL数组
	 */
	parseMediaLinks(content)

	/**
	 * 解析文章中的文本链接
	 * @param {string} content - 文章内容
	 * @returns {string[]} 文本链接数组
	 */
	parseTextLinks(content)

	/**
	 * 更新作品历史记录
	 * @param {Object} creation - 作品对象
	 */
	async updateCreation(creation)

	/**
	 * 获取所有的作品列表，按照最后阅读时间排序
	 * @returns {Promise<Object[]>} 作品列表
	 */
	async getCreations()

	/**
	 * 获取一个作品的详细信息
	 * @param {string} name - 作品名
	 * @returns {Promise<Object>} 作品信息
	 */
	async getCreation(name)

	/**
	 * 获取仓库的文件树结构（包括子目录）
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<Object>} 文件树对象，格式为 { type: 'directory', name: 'dir', children: [...] }
	 */
	async getRepositoryFiles(owner, repo) 
	
### 4.5 theme-service.js

	/**
	 * 初始化主题管理器
	 */
	init()

	/**
	 * 获取当前主题
	 */
	getCurrentTheme()

	/**
	 * 设置主题
	 */
	setTheme(theme)

	/**
	 * 获取主题图标
	 */
	getThemeIcon()

	/**
	 * 获取主题名称
	 */
	getThemeName()

	/**
	 * 应用主题
	 */
	applyTheme()

### 4.6 github-service.js

	/**
	 * 初始化 GitHub 服务
	 * @param {string} token - GitHub 访问令牌
	 * @returns {Promise<boolean>} 初始化是否成功
	 */
	async init(token)

	/**
	 * 检查API速率限制（使用rate_limit API端点）
	 * @returns {Promise<Object>} 速率限制信息 { limit: number, remaining: number }
	 */
	async checkRateLimit()

	/**
	 * 安全的 GitHub API 调用包装器
	 * @param {Function} apiCall - 要执行的 API 调用函数（返回 Promise）
	 * @returns {Promise} API 调用的结果
	 */
	async safeCall(apiCall)

	/**
	 * 获取 Octokit 实例（直接访问，不推荐，建议使用 safeCall）
	 * @returns {Object|null} Octokit 实例
	 */
	getOctokit()

	/**
	 * 列出仓库的所有 Issues
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {Object} options - 选项 (state, sort, direction等)
	 * @returns {Promise<Array>} Issues 列表
	 */
	async listIssues(owner, repo, options = {})

	/**
	 * 获取单个 Issue
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {number} issueNumber - Issue 编号
	 * @returns {Promise<Object>} Issue 对象
	 */
	async getIssue(owner, repo, issueNumber)

	/**
	 * 创建 Issue
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {Object} issue - Issue 数据 (title, body, labels等)
	 * @returns {Promise<Object>} 创建的 Issue
	 */
	async createIssue(owner, repo, issue)

	/**
	 * 获取仓库信息
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<Object>} 仓库信息
	 */
	async getRepo(owner, repo)

	/**
	 * 获取仓库文件内容
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {string} path - 文件路径
	 * @returns {Promise<Object>} 文件内容
	 */
	async getRepoContent(owner, repo, path)

	/**
	 * 检查用户是否已为仓库加星
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<boolean>} 是否已加星
	 */
	async isStarred(owner, repo)

	/**
	 * 为仓库加星
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @returns {Promise<void>}
	 */
	async starRepo(owner, repo)

	/**
	 * 获取已认证用户的信息
	 * @returns {Promise<Object>} 用户信息
	 */
	async getAuthenticatedUser()

	/**
	 * 执行自定义 API 请求
	 * @param {string} method - HTTP 方法
	 * @param {string} endpoint - API 端点
	 * @param {Object} options - 请求选项
	 * @returns {Promise<Object>} 响应数据
	 */
	async request(method, endpoint, options = {})

### 4.7 BasePage.js

	/**
	 * 挂载组件到DOM
	 * @param {HTMLElement} container - 挂载容器
	 * @param {any} path - 路径参数（可选）
	 */
	mount(container, path = null)

	/** 
	 * 辅助方法：获取i18n文本，如果服务不可用则返回默认值
	 * @param {string} key - 文本键
	 * @param {string} defaultValue - 默认文本
	 * @returns {string} 文本
	 */
	t(key, defaultValue = '')

	/**
	 * 获取i18n文本用于HTML属性（placeholder、value等）
	 * @param {string} key - 文本键
	 * @param {string} defaultValue - 默认文本
	 * @returns {string} 文本
	 */
	tAttr(key, defaultValue = '')

	/**
	* 渲染Header组件
	* @returns {string} Header组件的HTML字符串
	*/
	renderHeader()

	/**
	 * 显示CLA协议
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 * @param {Function} onSuccess - 签署成功回调
	 * @param {Function} [onCancel] - 取消回调
	 * @returns {Promise<void>}
	 */
	async showCLAAgreement(repoInfo, onSuccess, onCancel)

	/**
	 * 获取文件的SHA值（用于更新文件）
	 * @async
	 * @param {string} owner - 仓库所有者
	 * @param {string} repo - 仓库名称
	 * @param {string} path - 文件路径
	 * @returns {Promise<string|null>} 文件的SHA值，如果文件不存在返回null
	 */
	async getFileSha(owner, repo, path)

	/**
	 * 解析GitHub URL
	 * @param {string} url - GitHub URL
	 * @returns {Object|null} 解析结果
	 */
	parseGitHubUrl(url)
	
	/**
	 * 创建仓库
	 * @async
	 * @param {Object} repoInfo - 仓库信息
	 */
	async createRepository(repoInfo)

	/**
	 * 注销组件
	 */
	destroy()
