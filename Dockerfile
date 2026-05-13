FROM node:20-slim AS base

# yt-dlp + Python(curl-cffi venv) + ffmpeg + zip + 한글 폰트
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv ffmpeg curl zip fonts-noto-cjk && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir 'curl-cffi<0.13' && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Python 데몬이 사용할 curl-cffi 설치된 인터프리터 경로
ENV TIKTOK_PYTHON=/opt/venv/bin/python3

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
