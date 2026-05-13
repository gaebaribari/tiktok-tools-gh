FROM node:20-slim AS base

# yt-dlp + Python(curl-cffi 시스템 설치) + ffmpeg + zip + 한글 폰트
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg curl zip fonts-noto-cjk && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    pip3 install --break-system-packages --no-cache-dir 'curl-cffi<0.13' && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Python 데몬이 사용할 인터프리터 경로 (curl-cffi가 시스템 site-packages에 있음)
ENV TIKTOK_PYTHON=/usr/bin/python3

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p ./downloads

ENV PORT=3200
ENV NODE_ENV=production
EXPOSE 3200

CMD ["npm", "start"]
