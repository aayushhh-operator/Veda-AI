# apps/backend/Dockerfile
FROM node:22-slim

# Install dependencies for Puppeteer/Chromium
# This is required for PDF generation to work inside Docker
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Note: This Dockerfile expects the build context to be the root of the monorepo.
# Hugging Face Spaces will do this automatically if you specify the Dockerfile path in your README.md.
# Example README.md frontmatter for Hugging Face Spaces:
# ---
# title: VedaAI Backend
# emoji: 🚀
# colorFrom: blue
# colorTo: purple
# sdk: docker
# app_port: 7860
# dockerfile: apps/backend/Dockerfile
# ---

# Copy the entire monorepo
COPY . .

# Install dependencies for the entire workspace
RUN npm install

# Build shared package and backend
RUN npm run build -w @vedaai/shared
RUN npm run build -w @vedaai/backend

# Set environment variables
ENV NODE_ENV=production
# Hugging Face Spaces default port
ENV PORT=7860

EXPOSE 7860

# Start the server
CMD ["npm", "run", "start", "-w", "@vedaai/backend"]
