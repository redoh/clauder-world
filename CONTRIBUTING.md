# Contributing to Clauder World

Thanks for your interest in contributing to Clauder World! All contributions are welcome — features, bug fixes, documentation improvements, refactors, and more.

This project is licensed under the [MIT License](LICENSE), so your contributions will be too. No CLA or DCO is required.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.x recommended)
- A PostgreSQL database (or use the included Docker setup)

### Setup

```bash
git clone https://github.com/redoh/clauder-world.git
cd clauder-world
bun install
bunx prisma generate
bun dev
```

## Development Workflow

```bash
bun dev        # Start the development server
bun run build      # Production build
bun run lint       # Run ESLint
bun run typecheck  # Run TypeScript type checking
bun run format     # Format code with Prettier
```

## Submitting a Pull Request

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Verify everything passes locally:
   ```bash
   bun run lint
   bun run typecheck
   bun run build
   ```
4. Open a pull request against `main` with:
   - A clear description of what changed and why
   - How you tested the changes (steps to reproduce / verify)
   - **Screenshots or GIFs for any UI changes**

## Reporting Bugs

[Open a bug report](https://github.com/redoh/clauder-world/issues/new) — please include steps to reproduce, expected behavior, and actual behavior.

## Feature Requests

Have an idea? [Open a discussion](https://github.com/redoh/clauder-world/discussions) or create an issue. We love hearing new ideas, and discussing them first helps us collaborate on the best approach together.

## Security Issues

Please report security vulnerabilities privately — see [SECURITY.md](SECURITY.md) for details.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
