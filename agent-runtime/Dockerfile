# Aiveree agent service — a persistent host for the computer-use engine.
# Playwright's image ships Chromium + all the system libs it needs, so the
# browser "just works" in the container.
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

WORKDIR /app
ENV NODE_ENV=production

# Install deps first for layer caching.
COPY package.json ./
RUN npm install --omit=dev

# The Playwright base image ships a matching Chromium; let Playwright find it
# (do NOT set CHROMIUM_PATH here — detection in browser.js handles it).
ENV PORT=8080

COPY . .

EXPOSE 8080
CMD ["node", "service.js"]
