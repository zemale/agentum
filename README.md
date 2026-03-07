# Agentum

AI Agent Management Platform - A modern monorepo for building and managing AI agents.

## Project Structure

```
agentum/
├── backend/           # Node.js + Fastify API
├── frontend/          # Next.js 14 application
├── shared/            # Shared types, schemas, and utilities
├── docker-compose.yml # Infrastructure configuration
├── package.json       # Root workspaces configuration
└── .nvmrc            # Node.js version (20)
```

## Prerequisites

- Node.js 20+ (use `nvm use` to switch to the correct version)
- npm 10+

## Quick Start

```bash
# Switch to Node.js 20
nvm use

# Install dependencies for all workspaces
npm install

# Start development servers
npm run dev

# Build all workspaces
npm run build
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all development servers |
| `npm run build` | Build all workspaces |
| `npm run lint` | Run ESLint across all workspaces |
| `npm run lint:fix` | Fix ESLint issues automatically |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

## Workspaces

### Backend
Node.js API built with Fastify. Located in `/backend`.

### Frontend
Next.js 14 application. Located in `/frontend`.

### Shared
Shared types, schemas, and utilities used across workspaces. Located in `/shared`.

## License

MIT
