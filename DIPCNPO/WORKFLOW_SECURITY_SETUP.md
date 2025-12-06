# GitHub Actions 工作流安全设置指南

## 🔒 工作流文件保护设置

### 1. CODEOWNERS 文件设置

#### 创建 `.github/CODEOWNERS` 文件：

* @DIPCF/owners

#### 创建 `.github/workflows/cla-workflow.yml` 文件：
将cla-workflow.yml中的内容复制粘贴。

#### 创建 `.github/workflows/add-workflow.yml` 文件：
将add-workflow.yml中的内容复制粘贴。

#### 创建 `.github/workflows/statistics_workflow.yml` 文件：
将statistics_workflow.yml中的内容复制粘贴。

### 2. 分支保护规则设置

#### 在 `DIPCNPO/creations` 仓库中设置：

> **注意**：以下设置选项与GitHub实际界面完全对应，请按照界面中的确切选项名称进行配置。

1. **进入仓库设置**
   - 访问 `https://github.com/DIPCNPO/creations/settings`
   - 点击左侧菜单 "Branches"

2. **添加分支保护规则**
   - 点击 "Add rule" 或 "Add branch protection rule"
   - Branch name pattern: `main` (或您的主分支名称)

3. **配置保护规则**
   ✅ Require a pull request before merging
     ✅ Require approvals (设置至少1个审批)
     ✅ Dismiss stale pull request approvals when new commits are pushed
     ✅ Require review from Code Owners
   
   ✅ Require status checks to pass before merging
     ✅ Require branches to be up to date before merging
   
   ✅ Require conversation resolution before merging


### 第3步：添加
1. Settings -> Secrets and variables -> Actions
2. New repository secret
3. 添加 CLA_REPOSITORY_TOKEN 内容用所有者的令牌
