/**
 * 自定义组件基类
 * 提供组件生命周期管理和事件处理
 */
class Component {
	constructor(props = {}) {
		this.props = props;
		this.element = null;
		this.eventListeners = new Map();
	}

	/**
	 * 渲染组件
	 * 子类必须实现此方法
	 */
	async render() {
		throw new Error('Component must implement render method');
	}

	/**
	 * 挂载组件到DOM
	 * @param {HTMLElement} container - 挂载容器
	 * @param {any} path - 路径参数（可选）
	 */
	async mount(container, path = null) {
		this.element = path ? await this.render(path) : await this.render();
		if (container) {
			container.appendChild(this.element);
		}
		this.componentDidMount();
		return this.element;
	}

	/**
	 * 添加事件监听器
	 * @param {string} event - 事件类型
	 * @param {Function} handler - 事件处理函数
	 * @param {HTMLElement} target - 目标元素，默认为组件根元素
	 */
	addEventListener(event, handler, target = null) {
		const element = target || this.element;
		if (element) {
			element.addEventListener(event, handler);
			if (!this.eventListeners.has(element)) {
				this.eventListeners.set(element, []);
			}
			this.eventListeners.get(element).push({ event, handler });
		}
	}

	/**
	 * 移除事件监听器
	 * @param {string} event - 事件类型
	 * @param {Function} handler - 事件处理函数
	 * @param {HTMLElement} target - 目标元素，默认为组件根元素
	 */
	removeEventListener(event, handler, target = null) {
		const element = target || this.element;
		if (element) {
			element.removeEventListener(event, handler);
			if (this.eventListeners.has(element)) {
				const listeners = this.eventListeners.get(element);
				const index = listeners.findIndex(l => l.event === event && l.handler === handler);
				if (index > -1) {
					listeners.splice(index, 1);
				}
			}
		}
	}

	/**
	 * 组件挂载后调用
	 */
	componentDidMount() {
		// 子类可重写
	}

	/**
	 * 组件更新后调用
	 * @param {Object} prevState - 之前的状态
	 * @param {Object} currentState - 当前状态
	 */
	componentDidUpdate(prevState, currentState) {
		// 子类可重写
	}

	/**
	 * 组件销毁前调用
	 */
	componentWillUnmount() {
		// 清理事件监听器
		for (const [element, listeners] of this.eventListeners) {
			listeners.forEach(({ event, handler }) => {
				element.removeEventListener(event, handler);
			});
		}
		this.eventListeners.clear();
	}

	/**
	 * 销毁组件
	 */
	destroy() {
		this.componentWillUnmount();
		if (this.element && this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}
		this.element = null;
	}

	/**
	 * 创建DOM元素
	 * @param {string} tag - 标签名
	 * @param {Object} attributes - 属性
	 * @param {string|HTMLElement|Array} children - 子元素
	 * @returns {HTMLElement}
	 */
	createElement(tag, attributes = {}, children = []) {
		const element = document.createElement(tag);

		// 设置属性
		Object.keys(attributes).forEach(key => {
			if (key === 'className') {
				element.className = attributes[key];
			} else if (key === 'innerHTML') {
				element.innerHTML = attributes[key];
			} else if (key.startsWith('data-')) {
				element.setAttribute(key, attributes[key]);
			} else {
				element[key] = attributes[key];
			}
		});

		// 添加子元素
		if (typeof children === 'string') {
			element.textContent = children;
		} else if (children instanceof HTMLElement) {
			element.appendChild(children);
		} else if (Array.isArray(children)) {
			children.forEach(child => {
				if (typeof child === 'string') {
					element.appendChild(document.createTextNode(child));
				} else if (child instanceof HTMLElement) {
					element.appendChild(child);
				}
			});
		}

		return element;
	}

	/**
	 * HTML 转义函数，防止 XSS 攻击
	 * @param {string} text - 需要转义的文本
	 * @returns {string} 转义后的文本
	 */
	escapeHtml(text) {
		if (typeof text !== 'string') {
			return '';
		}
		const map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, m => map[m]);
	}

	/**
	 * HTML 属性转义函数，用于转义 HTML 属性值
	 * @param {string} text - 需要转义的文本
	 * @returns {string} 转义后的文本
	 */
	escapeHtmlAttribute(text) {
		if (typeof text !== 'string') {
			return '';
		}
		const map = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, m => map[m]);
	}

	/**
	 * Markdown转HTML转换器
	 * 使用成熟的 marked.js 库进行转换
	 * @param {string} markdown - Markdown文本
	 * @returns {string} HTML文本
	 */
	markdownToHtml(markdown) {
		if (!markdown) return '';

		if (!window.marked) {
			console.error('marked.js 未加载，无法转换 Markdown');
			return '';
		}

		try {
			// 配置 marked 选项（如果支持）
			if (!window.markedConfigured && typeof window.marked.setOptions === 'function') {
				window.marked.setOptions({
					breaks: true, // 支持 GitHub 风格的换行
					gfm: true,    // 启用 GitHub Flavored Markdown
				});
				window.markedConfigured = true;
			}

			// 兼容不同版本的 marked.js API
			// 新版本 (v5+): marked.parse()
			// 旧版本: marked()
			if (typeof window.marked.parse === 'function') {
				return window.marked.parse(markdown);
			} else if (typeof window.marked === 'function') {
				return window.marked(markdown);
			}

			console.error('marked.js API 不可用');
			return '';
		} catch (error) {
			console.error('marked.js 转换失败:', error);
			return '';
		}
	}
}

// 导出组件基类
window.Component = Component;
