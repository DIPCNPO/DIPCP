# Contributing to DIPCP

[中文版](CONTRIBUTING_zh-CN.md)

Thank you for considering contributing to the DIPCP project!
We believe that **“only collective wisdom can create masterpieces that stand the test of time.”**
To empower writers and creators worldwide to achieve more than they can alone, by providing a permanent, collaborative ecosystem where individual imagination is amplified by collective genius, leading to the creation of enduring intellectual property.

💬 **Discord Community**: Join our [Discord server](https://discord.gg/) for real-time discussions:

* **#general-dev** – Technical discussions, feature proposals, and development questions
* **#bugs-issues** – Bug reports and troubleshooting discussions

## Our Philosophy

* **Market Autonomy:** The value of content is determined by **reference count** and **net likes**, not by any committee or subjective evaluation.
* **Forking as Rights:** Contributors must accept that their creations within an **adopted path** may be **modified, terminated, or removed** and have no right to prevent such changes.
* **Legal Outsourcing:** The system does *not* handle arbitrations regarding **plagiarism, malicious damage**, or other legal disputes. Such matters must be resolved by the **affected parties** through legal channels.

## What Makes a Good Contribution?

Every contribution should enhance collaborative creativity. Ask yourself: **“Does this help people collaborate better?”**

**✅ Contributions that align well:**

* Filling missing features
* Fixing bugs
* Attracting more participants
* Improving user experience
* Better internationalization

**❌ Contributions that do *not* align:**

* Centralized designs
* Features that do not enhance collaboration
* Unnecessary increases in complexity
* Features that fragment or undermine the foundation of DIPCP

## Before You Contribute

### Reporting Bugs

1. **Check existing issues first** to avoid duplicates

2. **Consider discussing in Discord (#bugs-issues)** for quick help

3. **Use the bug report template** to create the issue — you need to provide:

   * Clear bug description
   * Steps to reproduce
   * Expected vs actual behavior
   * Model/IDE/BMad version info
   * Screenshots or links if applicable

4. **Indicate if you plan to fix it** to avoid duplicated work

### Suggesting Features or New Modules

1. **Discuss it first in Discord (#general-dev)** — the template will ask whether you have discussed it
2. **Check for existing issues/discussions**
3. **Use the feature request template**
4. **Explain how the feature improves collaboration**

### Before Starting Development

⚠️ **Before submitting a PR, you must:**

1. **For bug fixes**: Ensure an issue exists (create one if not)
2. **For features**: Discuss in Discord and create a feature issue
3. **For large changes**: Always open an issue first to discuss consistency and direction

Please submit **small and focused** changes!
Large changes should be discussed and split into multiple PRs to avoid wasted effort.

## Pull Request Guidelines

### Which Branch?

**All PRs must be submitted to the `main` branch** (critical fixes only):

* 🚨 Critical bug fixes (breaking core functionality)
* 🔒 Security patches
* 📚 Fixing severely incorrect documentation
* 🐛 Fixes for installation or basic usage failures

### PR Size Guidelines

* **Ideal size**: 200–400 lines of code
* **Maximum size**: 800 lines (generated files excluded)
* **One issue or feature per PR**
* **If larger than the limit**: Split into independent PRs
* **Even related changes should be separate** if they provide independent value

### How to Split Large PRs (>800 lines)

Consider whether:

* [ ] Refactoring can be separated from feature implementation
* [ ] API/interface can be added first, with implementation later
* [ ] Changes can be split by file or module
* [ ] Shared utilities/types can be submitted in a base PR
* [ ] Tests can be a separate PR
* [ ] Each part provides standalone value
* [ ] PRs can be merged in any order without breaking things

Example breakdown:

1. PR #1: Add utility functions and types (100 lines)
2. PR #2: Refactor existing code to use utilities (200 lines)
3. PR #3: Implement new feature (300 lines)
4. PR #4: Add complete tests (200 lines)

> Note: PR #1 and #4 can be submitted simultaneously since they are independent.

### Pull Request Process

#### New to PRs? No problem!

1. **Fork the repository**

2. **Clone your fork**

   ```
   git clone https://github.com/YOUR-USERNAME/DIPCP.git
   ```

3. **Create a new branch** — Never work directly on `main`

   ```bash
   git checkout -b fix/description
   # or
   git checkout -b feature/description
   ```

4. **Make your changes**

5. **Commit your changes**

   ```bash
   git add .
   git commit -m "fix: correct typo in README"
   ```

6. **Push to your fork**

7. **Create the PR on GitHub**

### PR Description Template

```markdown
## What

[1–2 sentences describing the change]

## Why

[1–2 sentences explaining why the change is needed]
Fixes #[issue number] (if applicable)

## How

## [2–3 bullet points on how it was implemented]

-
-

## Testing

[1–2 sentences describing how it was tested]
```

**Maximum PR description length: 200 words** (excluding code)

### Good vs Bad PR Examples

❌ **Bad:**

> This epic PR leverages state-of-the-art architecture to significantly optimize performance…

✅ **Good:**

> **What:** Added support for square screens
> **Why:** Foldable phones displayed layout incorrectly
> **How:**
> * Added corresponding styles in main.css
> **Testing:** Tested on a foldable device or resized browser to a square aspect ratio

### Commit Message Convention

Use Conventional Commits:

* `feat:` New feature
* `fix:` Bug fix
* `docs:` Documentation changes
* `refactor:` Code change without adding features or fixing bugs
* `test:` Adding or updating tests
* `chore:` Tooling or build system changes

Commit messages should be **under 72 characters**.

### Atomic Commits

Each commit should do exactly one thing:

* **Do:** One bug fix per commit
* **Do:** One feature per commit
* **Don’t:** Mix refactoring with bug fixes
* **Don’t:** Bundle unrelated changes

## What Makes a Good Pull Request?

✅ **Good PRs:**

* Change one thing at a time
* Clear, accurate titles
* Includes What/Why in the description
* Only necessary files are changed
* References related issues

❌ **Avoid:**

* Reformatting entire files
* Combining unrelated changes
* Copying your whole project into a PR
* Missing explanations
* Working directly on `main`

## Common Mistakes

1. **Do not reformat entire files**
2. **Do not include unrelated changes**
3. **Do not paste full code blocks in issues**
4. **Do not submit your whole project — only improvements**

## Code Style

* Follow existing code style and conventions
* Complex logic should have clear comments

## Code of Conduct

By contributing to this project, you agree to abide by our Code of Conduct.
We aim to build a respectful, collaborative community dedicated to creating great works.

## Need Help?

* 💬 Join our [Discord Community](https://discord.gg/)

  * **#general-dev** – Technical questions & feature discussions
  * **#bugs-issues** – Bug troubleshooting

* 🐛 Bug report template

* 💡 Feature request template

* 📖 GitHub Discussions

---

**Remember:** We are always here to help!
Every expert was once a beginner.
Let’s create stories that can be remembered for generations.

## [MIT License](LICENSE)

By contributing to this project, your contributions will be licensed under the same license as the project.
