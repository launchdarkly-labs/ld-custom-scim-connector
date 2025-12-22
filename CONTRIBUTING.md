# Contributing to SCIM Gateway

Thank you for your interest in contributing to this project! This document provides guidelines and instructions for contributing.

## LaunchDarkly Labs

This is a [LaunchDarkly Labs](https://github.com/launchdarkly-labs) project and is not officially supported by LaunchDarkly. It is maintained on a best-effort basis by the project maintainer and the community.

## How to Contribute

### Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub. When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce the issue
- Expected vs. actual behavior
- Your environment (Node.js version, OS, etc.)
- Relevant log output or error messages

### Submitting Pull Requests

1. **Fork the repository** and create your branch from `main`.

2. **Set up your development environment:**
   ```bash
   npm install
   npm run dev
   ```

3. **Make your changes:**
   - Follow the existing code style
   - Add or update tests as appropriate
   - Update documentation if needed

4. **Test your changes:**
   ```bash
   npm run build
   npm test
   ```

5. **Commit your changes** with a clear, descriptive commit message.

6. **Push to your fork** and submit a pull request.

### Pull Request Guidelines

- Keep PRs focused on a single change
- Include a clear description of what the PR does and why
- Reference any related issues
- Ensure all tests pass
- Update the CHANGELOG.md if appropriate

## Development

### Prerequisites

- Node.js 20 or later
- npm

### Running Locally

```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Project Structure

```
src/
├── index.ts              # Entry point
├── config/               # Configuration loading
├── db/                   # Database layer (SQLite)
├── mapping/              # Role transformation logic
├── middleware/           # Express middleware (auth, logging)
└── scim/
    ├── client/           # LaunchDarkly SCIM client
    ├── schemas/          # TypeScript type definitions
    └── server/           # SCIM server endpoints
```

### Code Style

- Use TypeScript for all source files
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Keep functions focused and small
- Handle errors appropriately

## License

By contributing to this project, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.

