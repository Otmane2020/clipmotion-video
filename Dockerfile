FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
  ffmpeg \
  chromium \
  libnspr4 \
  libnss3 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libgtk-3-0 \
  fonts-liberation \
  --no-install-recommends

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm","start"]
