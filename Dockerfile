# syntax=docker/dockerfile:1

FROM node:22-slim AS base

# Update package lists and install dependencies
RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        git \
        build-essential \
        python3-dev \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set destination for COPY
WORKDIR /app

# Copy package files first for better caching
COPY container_src/package*.json ./

# Install npm dependencies
RUN npm install

# Copy TypeScript configuration
COPY container_src/tsconfig.json ./

# Copy source code
COPY container_src/src/ ./src/

# Build TypeScript
RUN npm run build

EXPOSE 8080

# Run the compiled JavaScript
CMD ["node", "dist/main.js"]