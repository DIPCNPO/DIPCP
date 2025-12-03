/**
 * 下拉菜单组件
 * 用于工具栏和导航中的下拉菜单
 */
class Dropdown extends Component {
	constructor(props = {}) {
		super(props);
		this.state = {
			trigger: props.trigger || '⋯',
			triggerKey: props.triggerKey || '',
			items: props.items || [],
			open: props.open || false,
			className: props.className || '',
			position: props.position || 'bottom-right', // bottom-left, bottom-right, top-left, top-right
			onToggle: props.onToggle || null,
			onItemClick: props.onItemClick || null
		};
	}

	render() {
		const classes = this.buildClasses();

		return `
            <div class="dropdown ${classes}">
                <button class="dropdown-toggle" type="button">
                    ${this.state.triggerKey ? `data-i18n="${this.state.triggerKey}"` : this.state.trigger}
                </button>
                <div class="dropdown-menu ${this.state.open ? 'open' : ''} dropdown-${this.state.position}">
                    ${this.renderItems()}
                </div>
            </div>
        `;
	}

	buildClasses() {
		const classes = ['dropdown'];

		if (this.state.className) {
			classes.push(this.state.className);
		}

		return classes.join(' ');
	}

	renderItems() {
		return this.state.items.map((item, index) => {
			if (typeof item === 'string') {
				return `
                    <div class="dropdown-item dropdown-item-text">
                        ${item}
                    </div>
                `;
			}

			if (item && typeof item === 'object') {
				const {
					text = '',
					textKey = '',
					icon = '',
					href = '#',
					disabled = false,
					divider = false,
					onClick = null
				} = item;

				if (divider) {
					return '<div class="dropdown-divider"></div>';
				}

				const itemClasses = ['dropdown-item'];
				if (disabled) {
					itemClasses.push('disabled');
				}

				return `
                    <a 
                        href="${href}" 
                        class="${itemClasses.join(' ')}"
                        ${textKey ? `data-i18n="${textKey}"` : ''}
                        ${onClick ? `data-action="click" data-index="${index}"` : ''}
                        ${disabled ? 'tabindex="-1"' : ''}
                    >
                        ${icon ? `<span class="dropdown-item-icon">${icon}</span>` : ''}
                        ${textKey ? '' : text}
                    </a>
                `;
			}

			return '';
		}).join('');
	}

	bindEvents() {
		// 绑定切换按钮点击事件
		const toggleBtn = this.element.querySelector('.dropdown-toggle');
		if (toggleBtn) {
			toggleBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.toggle();
			});
		}

		// 绑定菜单项点击事件
		const menuItems = this.element.querySelectorAll('[data-action="click"]');
		menuItems.forEach(item => {
			item.addEventListener('click', (e) => {
				e.preventDefault();
				const index = parseInt(item.dataset.index);
				const itemConfig = this.state.items[index];

				if (itemConfig && itemConfig.onClick) {
					itemConfig.onClick(itemConfig, e);
				}

				if (this.state.onItemClick) {
					this.state.onItemClick(itemConfig, e);
				}

				this.close();
			});
		});

		// 点击外部关闭菜单
		document.addEventListener('click', (e) => {
			if (!this.element.contains(e.target)) {
				this.close();
			}
		});
	}

	toggle() {
		const open = !this.state.open;
		this.setState({ open });
		this.update();

		if (this.state.onToggle) {
			this.state.onToggle(open);
		}
	}

	open() {
		this.setState({ open: true });
		this.update();
	}

	close() {
		this.setState({ open: false });
		this.update();
	}

	addItem(item) {
		const items = [...this.state.items, item];
		this.setState({ items });
		this.update();
	}

	removeItem(index) {
		const items = this.state.items.filter((_, i) => i !== index);
		this.setState({ items });
		this.update();
	}

	updateItem(index, updates) {
		const items = [...this.state.items];
		if (items[index]) {
			items[index] = { ...items[index], ...updates };
			this.setState({ items });
			this.update();
		}
	}
}

// 导出组件
window.Dropdown = Dropdown;