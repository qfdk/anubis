# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anubis is a web-based management interface for fail2ban. It allows you to manage IP bans, create and configure fail2ban jails, and customize filters. The application is built with Node.js and Express, using EJS templates for the frontend.

## Prerequisites

### Development Mode
- Node.js 18.x or higher
- pnpm (recommended) or npm

### Production Mode
- Node.js 18.x or higher
- pnpm (recommended) or npm
- fail2ban installed on the system
- Proper permissions to access fail2ban configuration files

## Environment Configuration

The application uses a `.env` file for configuration. Copy `.env.example` to `.env` and set the following variables:

```
PORT=1233
USERNAME=admin
PASSWORD=admin
BASE_PATH=""
LOG_LEVEL=info

# Development/Production mode toggle
# true for mock mode, no real fail2ban needed
# false for real fail2ban data
IS_MOCK=true

# Only needed when IS_MOCK=false
FAIL2BAN_SOCKET_PATH=/var/run/fail2ban/fail2ban.sock
FAIL2BAN_JAIL_PATH=/etc/fail2ban/jail.d
FAIL2BAN_FILTER_PATH=/etc/fail2ban/filter.d

# Security settings
SESSION_SECRET=some-random-string
JWT_SECRET=another-random-string
```

## Development Commands

```bash
# Install dependencies
npm install
# 或使用 pnpm
pnpm install

# Start the development server with auto-reload
npm run dev
# 或使用 pnpm
pnpm dev

# Build the application for production 
npm run build
# 或使用 pnpm
pnpm build

# Update IP geolocation database
npm run update
# 或使用 pnpm
pnpm update
```

## Project Structure

- `app.js` - Main application entry point
- `bin/www` - HTTP server setup
- `middlewares/auth.js` - Authentication middleware
- `routes/` - API and page routes
  - `routes/public.js` - Public routes (login page)
  - `routes/admin/` - Admin panel routes
    - `routes/admin/jail.js` - Manage fail2ban jails
    - `routes/admin/filter.js` - Manage fail2ban filters
- `utils/` - Utility functions
- `views/` - EJS templates for UI
- `public/` - Static assets

## Deployment

The application can be deployed using PM2:

1. Copy `pm2.json.example` to `pm2.json`
2. Modify configuration as needed
3. Run `pm2 start pm2.json`

For production environments, it's recommended to set up a reverse proxy using Nginx.