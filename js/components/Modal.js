/**
 * 通用模态框组件
 * 支持输入模态框、确认模态框、信息模态框、下拉选择框、CLA模态框五种类型
 */
class Modal extends Component {
	constructor(props = {}) {
		super(props);
		this.state = {
			show: props.show || false,
			type: props.type || 'info', // 'input', 'confirm', 'info', 'cla', 'select'
			title: props.title || '',
			message: props.message || props.content || '',
			placeholder: props.placeholder || '',
			defaultValue: props.defaultValue || '',
			callback: props.callback || null,
			inputValue: props.defaultValue || '',
			showCancel: props.showCancel !== false,
			inputLabel: props.inputLabel || '',
			inputPlaceholder: props.inputPlaceholder || '',
			claContent: props.claContent || '',
			selectOptions: props.selectOptions || [], // 下拉列表选项 [{value, label}]
			selectedValue: props.selectedValue || '', // 选中的值
			selectLabel: props.selectLabel || '', // 下拉列表标签
			onSelectChange: props.onSelectChange || null, // 选择变化回调
			isProcessing: props.isProcessing || false, // 是否正在处理中
		};

		// 事件处理器的引用，用于正确移除事件监听器
		this.eventHandlers = {
			handleCancel: () => this.handleCancel(),
			handleConfirm: () => this.handleConfirm(),
			handleInputChange: (e) => this.handleInputChange(e),
			handleKeyDown: (e) => this.handleKeyDown(e),
			handleOverlayClick: (e) => this.handleOverlayClick(e)
		};
	}

	/**
	 * 显示输入模态框
	 * @param {string} title - 标题
	 * @param {string} message - 提示信息
	 * @param {string} placeholder - 输入框占位符
	 * @param {string} defaultValue - 默认值
	 * @param {function} callback - 确认回调函数
	 */
	showInput(title, message, placeholder = '', defaultValue = '', callback = null) {
		this.state.show = true;
		this.state.type = 'input';
		this.state.title = title;
		this.state.message = message;
		this.state.placeholder = placeholder;
		this.state.defaultValue = defaultValue;
		this.state.callback = callback;
		this.state.inputValue = defaultValue;
		this.updateModal();
	}

	/**
	 * 显示确认模态框
	 * @param {string} title - 标题
	 * @param {string} message - 确认信息
	 * @param {function} callback - 确认回调函数
	 */
	showConfirm(title, message, callback = null) {
		this.state.show = true;
		this.state.type = 'confirm';
		this.state.title = title;
		this.state.message = message;
		this.state.callback = callback;
		this.updateModal();
	}

	/**
	 * 显示信息模态框
	 * @param {string} title - 标题
	 * @param {string} message - 信息内容
	 * @param {Object} [options] - 可选配置
	 * @param {boolean} [options.showCancel=false] - 是否显示取消按钮
	 */
	showInfo(title, message, options = {}) {
		this.state.show = true;
		this.state.type = 'info';
		this.state.title = title;
		this.state.message = message;
		this.state.showCancel = options.showCancel !== undefined ? options.showCancel : false;
		this.updateModal();
	}

	/**
	 * 显示下拉选择模态框
	 * @param {string} title - 标题
	 * @param {string} selectLabel - 下拉列表标签
	 * @param {Array} options - 选项数组 [{value, label}]
	 * @param {function} onSelectChange - 选择变化回调函数 (value) => {}
	 * @param {function} callback - 确认回调函数 (selectedValue) => {}
	 * @param {string} [defaultValue] - 默认选中的值
	 */
	showSelect(title, selectLabel, options = [], onSelectChange = null, callback = null, defaultValue = '') {
		this.state.show = true;
		this.state.type = 'select';
		this.state.title = title;
		this.state.selectLabel = selectLabel;
		this.state.selectOptions = options;
		this.state.selectedValue = defaultValue || (options.length > 0 ? options[0].value : '');
		this.state.onSelectChange = onSelectChange;
		this.state.callback = callback;
		this.updateModal();
	}

	/**
	 * 设置处理中状态
	 * @param {boolean} isProcessing - 是否正在处理中
	 */
	setProcessing(isProcessing) {
		this.state.isProcessing = isProcessing;
		// 只更新按钮部分，不重新渲染整个模态框
		const confirmBtn = this.element?.querySelector('#modal-confirm');
		const cancelBtn = this.element?.querySelector('#modal-cancel');

		if (confirmBtn) {
			const t = (key, fallback) => {
				if (window.I18nService && window.I18nService.t) {
					return window.I18nService.t(key, fallback);
				}
				return fallback;
			};

			if (isProcessing) {
				confirmBtn.disabled = true;
				confirmBtn.textContent = t('common.processing', '处理中...');
				confirmBtn.style.cursor = 'wait';
				if (cancelBtn) {
					cancelBtn.disabled = true;
				}
			} else {
				confirmBtn.disabled = false;
				confirmBtn.textContent = this.state.confirmText || t('common.confirm', '确认');
				confirmBtn.style.cursor = '';
				if (cancelBtn) {
					cancelBtn.disabled = false;
				}
			}
		}

		// 同时更新模态框的 cursor 样式
		if (this.element) {
			if (isProcessing) {
				this.element.style.cursor = 'wait';
			} else {
				this.element.style.cursor = '';
			}
		}
	}

	/**
	 * 隐藏模态框
	 */
	hide() {
		// 先清理事件监听器
		this.unbindEvents();

		// 直接从DOM中移除模态框
		if (this.element && this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}

		// 清空element引用
		this.element = null;

		// 重置状态
		this.state.show = false;
		this.state.type = 'info';
		this.state.title = '';
		this.state.message = '';
		this.state.placeholder = '';
		this.state.defaultValue = '';
		this.state.callback = null;
		this.state.inputValue = '';
		this.state.selectOptions = [];
		this.state.selectedValue = '';
		this.state.selectLabel = '';
		this.state.onSelectChange = null;
		this.state.isProcessing = false;
		this.updateModal();
	}

	/**
	 * 处理确认操作
	 */
	async handleConfirm() {
		// CLA 类型需要等待异步操作完成后再隐藏（由回调函数内部控制隐藏）
		if (this.state.type === 'cla' && this.onConfirm && typeof this.onConfirm === 'function') {
			try {
				// 等待异步回调完成（回调函数内部会调用 modal.hide()）
				await Promise.resolve(this.onConfirm(this.state.inputValue));
				return;
			} catch (error) {
				// 如果出错，回调函数内部会处理隐藏逻辑
				console.error('CLA 确认回调执行失败:', error);
				throw error;
			}
		} else if (this.state.type === 'cla' && this.state.callback && typeof this.state.callback === 'function') {
			try {
				await Promise.resolve(this.state.callback(this.state.inputValue));
				return;
			} catch (error) {
				console.error('CLA 确认回调执行失败:', error);
				throw error;
			}
		}

		// 其他类型的处理
		if (this.state.type === 'input' && this.state.callback && typeof this.state.callback === 'function') {
			this.state.callback(this.state.inputValue);
		} else if (this.state.type === 'select' && this.state.callback && typeof this.state.callback === 'function') {
			this.state.callback(this.state.selectedValue);
		} else if (this.state.type === 'confirm' && this.state.callback && typeof this.state.callback === 'function') {
			console.log('🔍 [Modal.handleConfirm] 调用 confirm 回调函数');
			this.state.callback(true);
			console.log('🔍 [Modal.handleConfirm] 回调函数调用完成');
		} else if (this.state.type === 'info' && this.onConfirm && typeof this.onConfirm === 'function') {
			this.onConfirm();
		} else if (this.state.type === 'info' && this.state.callback && typeof this.state.callback === 'function') {
			this.state.callback(true);
		}
		// info类型总是可以关闭
		this.hide();
	}

	/**
	 * 处理取消操作
	 */
	handleCancel() {
		if (this.state.type === 'confirm' && this.state.callback && typeof this.state.callback === 'function') {
			console.log('🔍 [Modal.handleCancel] 调用 confirm 回调函数 (false)');
			this.state.callback(false);
			console.log('🔍 [Modal.handleCancel] 回调函数调用完成');
		} else if (this.state.type === 'cla' && this.onCancel && typeof this.onCancel === 'function') {
			this.onCancel();
		} else if (this.state.type === 'info' && this.onCancel && typeof this.onCancel === 'function') {
			this.onCancel();
		}
		// info类型总是可以关闭，即使没有onCancel回调
		this.hide();
	}

	/**
	 * 处理输入框变化
	 */
	handleInputChange(event) {
		this.state.inputValue = event.target.value;
	}

	/**
	 * 处理下拉列表变化
	 */
	handleSelectChange(event) {
		this.state.selectedValue = event.target.value;
		if (this.state.onSelectChange) {
			this.state.onSelectChange(this.state.selectedValue);
		}
	}

	/**
	 * 处理键盘事件
	 */
	handleKeyDown(event) {
		if (event.key === 'Enter' && this.state.type === 'input') {
			this.handleConfirm();
		} else if (event.key === 'Escape') {
			this.handleCancel();
		}
	}

	/**
	 * 处理遮罩点击
	 */
	handleOverlayClick(event) {
		// 只处理直接点击遮罩层的情况，不处理点击模态框内容的情况
		if (event.target === event.currentTarget) {
			event.stopPropagation();
			this.handleCancel();
		}
	}

	render() {
		if (!this.state.show) {
			// 返回null，表示不渲染任何内容
			return null;
		}

		const modalElement = document.createElement('div');
		modalElement.className = 'modal-overlay';
		const modalContent = document.createElement('div');
		modalContent.className = 'modal-content';
		// 阻止点击事件冒泡到遮罩层
		modalContent.addEventListener('click', (e) => {
			e.stopPropagation();
		});

		modalContent.innerHTML = `
			<div class="modal-header">
				<h3>${this.state.title}</h3>
			</div>
			<div class="modal-body">
				${this.renderBody()}
			</div>
			<div class="modal-footer">
				${this.renderFooter()}
			</div>
		`;

		modalElement.appendChild(modalContent);

		// Modal是特殊的，它创建自己的DOM，不通过Component.mount
		// 返回包含content的overlay元素
		return modalElement;
	}


	/**
	 * 渲染模态框主体内容
	 */
	renderBody() {
		switch (this.state.type) {
			case 'input':
				return `
					<div class="form-group">
						<label for="modal-input">${this.escapeHtml(this.state.message)}</label>
						<input
							type="text"
							id="modal-input"
							placeholder="${this.state.placeholder}"
							value="${this.state.inputValue}"
						/>
					</div>
				`;
			case 'cla':
				return `
					<div class="cla-content">
						<div class="cla-message">
							<p>${this.state.message}</p>
						</div>
					<div class="cla-agreement" id="cla-agreement-container">
						<div class="cla-text" id="cla-markdown-content">${this.markdownToHtml(this.state.claContent)}</div>
					</div>
						<div class="form-group">
							<label for="modal-input">${this.escapeHtml(this.state.inputLabel)}</label>
							<input
								type="text"
								id="modal-input"
								placeholder="${this.state.inputPlaceholder}"
								value="${this.state.inputValue}"
							/>
						</div>
					</div>
				`;
			case 'confirm':
				return `
					<div class="confirm-message">
						<div class="confirm-icon">⚠️</div>
						<div class="confirm-content">
							<p>${this.state.message}</p>
						</div>
					</div>
				`;
			case 'info':
				return `
					<div class="info-message">
						<div class="info-icon">ℹ️</div>
						<div class="info-content">
							${this.state.message}
						</div>
					</div>
				`;
			case 'select':
				const selectOptionsHtml = this.state.selectOptions.map(option => {
					const selected = option.value === this.state.selectedValue ? 'selected' : '';
					return `<option value="${this.escapeHtmlAttribute(option.value)}" ${selected}>${this.escapeHtml(option.label)}</option>`;
				}).join('');
				return `
					<div class="form-group">
						<label for="modal-select">${this.escapeHtml(this.state.selectLabel)}</label>
						<select id="modal-select" style="width: 100%; padding: 8px;">
							${selectOptionsHtml}
						</select>
					</div>
					<div id="modal-select-content" style="margin-top: 16px; max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); padding: 12px; border-radius: 4px;">
					</div>
				`;
			default:
				return '';
		}
	}

	/**
	 * 渲染模态框底部按钮
	 */
	renderFooter() {
		const t = (key, fallback) => {
			if (window.I18nService && window.I18nService.t) {
				return window.I18nService.t(key, fallback);
			}
			return fallback;
		};

		switch (this.state.type) {
			case 'input':
				return `
					<button class="btn btn-secondary" id="modal-cancel">${t('common.cancel', '取消')}</button>
					<button class="btn btn-primary" id="modal-confirm">${t('common.confirm', '确认')}</button>
				`;
			case 'cla':
				const claConfirmText = this.state.isProcessing
					? t('common.processing', '处理中...')
					: (this.state.confirmText || t('common.confirm', '确认'));
				const claConfirmDisabled = this.state.isProcessing ? 'disabled' : '';
				// 注意：初始的 disabled 状态由 bindEvents 中的逻辑控制（需要滚动到底部且输入姓名）
				return `
					<button class="btn btn-secondary" id="modal-cancel" ${this.state.isProcessing ? 'disabled' : ''}>${t('common.cancel', '取消')}</button>
					<button class="btn btn-primary" id="modal-confirm" ${claConfirmDisabled} style="${this.state.isProcessing ? 'cursor: wait;' : ''}">${claConfirmText}</button>
				`;
			case 'confirm':
				return `
					<button class="btn btn-secondary" id="modal-cancel">${t('common.cancel', '取消')}</button>
					<button class="btn btn-danger" id="modal-confirm">${t('common.confirm', '确认')}</button>
				`;
			case 'select':
				return `
					<button class="btn btn-secondary" id="modal-cancel">${t('common.cancel', '取消')}</button>
					<button class="btn btn-primary" id="modal-confirm">${t('common.confirm', '确认')}</button>
				`;
			case 'info':
				if (this.state.showCancel) {
					return `
					<button class="btn btn-secondary" id="modal-cancel">${t('common.cancel', '取消')}</button>
					<button class="btn btn-primary" id="modal-confirm">${t('common.confirm', '确认')}</button>
				`;
				} else {
					return `
					<button class="btn btn-primary" id="modal-close-footer">${t('common.close', '关闭')}</button>
				`;
				}
			default:
				return '';
		}
	}

	/**
	 * 更新模态框显示
	 */
	updateModal() {
		// 如果模态框元素不存在或不在DOM中，创建新的模态框
		if (!this.element || !this.element.parentNode) {
			// 只有在 show 为 true 时才渲染
			if (!this.state.show) {
				return;
			}
			const newElement = this.render();
			if (newElement && newElement instanceof Node) {
				document.body.appendChild(newElement);
				this.element = newElement;
				this.bindEvents();
			}
			return;
		}

		// 如果模态框已经存在于DOM中，更新内容
		const titleEl = this.element.querySelector('.modal-header h3');
		if (titleEl) {
			// 使用 textContent 而不是 innerHTML，自动防止 XSS
			titleEl.textContent = this.state.title;
		}

		const bodyEl = this.element.querySelector('.modal-body');
		if (bodyEl) {
			bodyEl.innerHTML = this.renderBody();
		}

		const footerEl = this.element.querySelector('.modal-footer');
		if (footerEl) {
			footerEl.innerHTML = this.renderFooter();
		}

		// 重新绑定事件
		this.bindEvents();
	}

	bindEvents() {
		if (!this.element) return;

		// 先移除所有现有的事件监听器，避免重复绑定
		this.unbindEvents();

		// 关闭按钮（底部）
		const closeFooterBtn = this.element.querySelector('#modal-close-footer');
		if (closeFooterBtn) {
			closeFooterBtn.addEventListener('click', this.eventHandlers.handleCancel);
		}

		// 取消按钮
		const cancelBtn = this.element.querySelector('#modal-cancel');
		if (cancelBtn) {
			cancelBtn.addEventListener('click', this.eventHandlers.handleCancel);
		}

		// 确认按钮
		const confirmBtn = this.element.querySelector('#modal-confirm');
		if (confirmBtn) {
			confirmBtn.addEventListener('click', this.eventHandlers.handleConfirm);
		}

		// 输入框
		const input = this.element.querySelector('#modal-input');
		if (input) {
			input.addEventListener('input', this.eventHandlers.handleInputChange);
			input.addEventListener('keydown', this.eventHandlers.handleKeyDown);
			// 自动聚焦
			setTimeout(() => input.focus(), 100);
		}

		// 下拉列表（select类型）
		const select = this.element.querySelector('#modal-select');
		if (select) {
			select.addEventListener('change', (e) => this.handleSelectChange(e));
			// 保存事件处理器以便后续移除
			this.eventHandlers.handleSelectChange = (e) => this.handleSelectChange(e);
		}

		// CLA类型：添加滚动监听，检查是否滚动到底部，以及是否输入了姓名
		if (this.state.type === 'cla') {
			const claContainer = this.element.querySelector('#cla-agreement-container');
			const claInput = this.element.querySelector('#modal-input');

			if (claContainer) {
				const checkScroll = () => {
					// 如果正在处理中，保持禁用状态
					if (this.state.isProcessing) {
						if (confirmBtn) {
							confirmBtn.disabled = true;
						}
						return;
					}

					const scrollTop = claContainer.scrollTop;
					const scrollHeight = claContainer.scrollHeight;
					const clientHeight = claContainer.clientHeight;
					// 允许5px的误差
					const isScrolledToBottom = scrollTop + clientHeight >= scrollHeight - 5;

					// 检查是否输入了姓名（去除首尾空格后不为空）
					const hasName = claInput && claInput.value.trim().length > 0;

					if (confirmBtn) {
						// 必须同时满足：滚动到底部 且 输入了姓名
						confirmBtn.disabled = !(isScrolledToBottom && hasName);
					}
				};

				// 绑定滚动事件
				claContainer.addEventListener('scroll', checkScroll);

				// 绑定输入框输入事件，当用户输入姓名时也检查
				if (claInput) {
					claInput.addEventListener('input', checkScroll);
					// 保存输入事件处理器以便后续移除
					this.eventHandlers.handleCLAInput = checkScroll;
				}

				// 保存事件处理器以便后续移除
				this.eventHandlers.handleCLAScroll = checkScroll;
			}
		}

		// 遮罩点击（使用捕获阶段，但需要确保按钮点击不被拦截）
		this.element.addEventListener('click', this.eventHandlers.handleOverlayClick);

		// 键盘事件
		document.addEventListener('keydown', this.eventHandlers.handleKeyDown);
	}

	unbindEvents() {
		if (!this.element) return;

		const closeFooterBtn = this.element.querySelector('#modal-close-footer');
		if (closeFooterBtn) {
			closeFooterBtn.removeEventListener('click', this.eventHandlers.handleCancel);
		}

		const cancelBtn = this.element.querySelector('#modal-cancel');
		if (cancelBtn) {
			cancelBtn.removeEventListener('click', this.eventHandlers.handleCancel);
		}

		const confirmBtn = this.element.querySelector('#modal-confirm');
		if (confirmBtn) {
			confirmBtn.removeEventListener('click', this.eventHandlers.handleConfirm);
		}

		const input = this.element.querySelector('#modal-input');
		if (input) {
			input.removeEventListener('input', this.eventHandlers.handleInputChange);
			input.removeEventListener('keydown', this.eventHandlers.handleKeyDown);
		}

		// 移除下拉列表事件监听器
		const select = this.element.querySelector('#modal-select');
		if (select && this.eventHandlers.handleSelectChange) {
			select.removeEventListener('change', this.eventHandlers.handleSelectChange);
			delete this.eventHandlers.handleSelectChange;
		}

		// 移除CLA滚动事件监听器
		if (this.eventHandlers.handleCLAScroll) {
			const claContainer = this.element.querySelector('#cla-agreement-container');
			if (claContainer) {
				claContainer.removeEventListener('scroll', this.eventHandlers.handleCLAScroll);
			}
			delete this.eventHandlers.handleCLAScroll;
		}

		// 移除CLA输入框事件监听器
		if (this.eventHandlers.handleCLAInput) {
			const claInput = this.element.querySelector('#modal-input');
			if (claInput) {
				claInput.removeEventListener('input', this.eventHandlers.handleCLAInput);
			}
			delete this.eventHandlers.handleCLAInput;
		}

		// 移除遮罩点击事件
		this.element.removeEventListener('click', this.eventHandlers.handleOverlayClick, true);

		// 移除键盘事件监听
		document.removeEventListener('keydown', this.eventHandlers.handleKeyDown);
	}

	destroy() {
		this.unbindEvents();
		super.destroy();
	}
}

// 导出组件
window.Modal = Modal;
