FROM node:20-bookworm-slim

# LibreOffice is required to convert FORM 9 (a legacy .doc) to .docx.
# --no-install-recommends keeps the image smaller; libreoffice-writer
# alone covers the --headless --convert-to docx path this app uses.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Match documentGenerator.js's LibreOffice lookup (LIBREOFFICE_PATH
# env var, or "soffice" on PATH - Debian's package installs it there).
ENV LIBREOFFICE_PATH=soffice

EXPOSE 5000

CMD ["node", "server.js"]
