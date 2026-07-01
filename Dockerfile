# ── Base image: Node 20 on Debian (needed for LibreOffice) ───────────────────
FROM node:20-bookworm-slim

# ── System dependencies (LibreOffice only — no more Chromium/Playwright) ─────
RUN apt-get update && apt-get install -y \
# LibreOffice for PPTX → PDF
libreoffice \
# Fonts for proper PDF rendering
fonts-liberation \
# Chromium dependencies for Puppeteer (HTML → PDF report cards)
ca-certificates libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 \
libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
libnspr4 libnss3 libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
libxss1 libxtst6 lsb-release wget xdg-utils \
&& rm -rf /var/lib/apt/lists/*
# Ensure Puppeteer downloads its Chromium during npm install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

                    # ── Disable Java in LibreOffice (JVM cannot start in Railway's container) ────
                    # The JVM hits OS thread limits (EAGAIN) and crashes; LibreOffice does not
                    # need Java for headless PPTX→PDF conversion via the Impress filter.
                    RUN mkdir -p /root/.config/libreoffice/4/user \
                        && printf '<?xml version="1.0" encoding="UTF-8"?>\n<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n <item oor:path="/org.openoffice.Office.Java"><prop oor:name="Enable" oor:op="fuse"><value>false</value></prop></item>\n</oor:items>\n' \
                            > /root/.config/libreoffice/4/user/registrymodifications.xcu

                            # ── Verify LibreOffice at build time ─────────────────────────────────────────
                            RUN soffice --headless --version

                            # ── Set working directory ─────────────────────────────────────────────────────
                            WORKDIR /app

                            # ── Install Node deps ─────────────────────────────────────────────────────────
                            COPY package.json .
                            RUN npm install --production

                            # ── Copy app code ─────────────────────────────────────────────────────────────
                            COPY . .

                            # ── Create tmp directory ──────────────────────────────────────────────────────
                            RUN mkdir -p /app/tmp && chmod 777 /app/tmp

                            # ── Expose port ───────────────────────────────────────────────────────────────
                            ENV PORT=3000
                            EXPOSE 3000

                            # ── Start ─────────────────────────────────────────────────────────────────────
                            CMD ["node", "server.js"]
