# Contributing to Memedge

Thank you for your interest in contributing to Memedge! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/memedge.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development

```bash
# Build the project
npm run build

# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Code Style

- Use TypeScript strict mode
- Follow the existing code style
- Use Effect for error handling
- Add JSDoc comments for public APIs
- Write tests for new features

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the CHANGELOG.md with your changes
3. Ensure all tests pass
4. Ensure TypeScript compiles without errors
5. Submit your pull request

## Testing

- Write unit tests for new functionality
- Ensure all existing tests pass
- Aim for high test coverage

## Commit Messages

- Use clear and descriptive commit messages
- Follow conventional commits format: `type(scope): description`
  - `feat`: A new feature
  - `fix`: A bug fix
  - `docs`: Documentation changes
  - `test`: Adding or updating tests
  - `refactor`: Code refactoring
  - `chore`: Maintenance tasks

Example: `feat(memory): add semantic search threshold configuration`

## Questions?

Feel free to open an issue for any questions or discussions.

Thank you for contributing! 🙏

