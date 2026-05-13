# TikTok Tools

TikTok 크리에이터 프로필을 일괄 조회하고, 영상 다운로드와 고유주소 추출을 지원하는 웹 도구.

## 기능

- **크리에이터 조회** — 여러 TikTok 핸들을 한 번에 입력해 프로필 정보를 일괄 수집 (팔로워, 영상 수, 이메일, 인증 배지 등)
- **고유주소 추출** — 핸들이 바뀌어도 변하지 않는 숫자ID 기반 고유주소 변환
- **영상 다운로드** — 여러 영상 URL을 ZIP으로 일괄 다운로드, 파일명 템플릿 지정 가능

## 스택

- Next.js 16 (App Router) · TypeScript · Tailwind CSS
- yt-dlp + curl-cffi (TikTok HTTP impersonation)
- Python HTML fetcher 데몬 풀

## 로컬 실행

### 사전 요구사항

```bash
# yt-dlp 설치
brew install yt-dlp   # macOS
# 또는: sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp

# ffmpeg 설치 (영상 다운로드 시 필요)
brew install ffmpeg

# curl-cffi 설치 (yt-dlp impersonation용)
/opt/homebrew/opt/yt-dlp/libexec/bin/pip install 'curl-cffi<0.13'
```

### 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local에서 TIKTOK_PYTHON 경로 설정

npm run dev
# http://localhost:3200
```

## Docker

```bash
docker build -t tiktok-tools .
docker run -p 3200:3200 tiktok-tools
```

## 주요 기술 결정

자세한 개발 과정과 의사결정은 [TIMELINE.md](./TIMELINE.md) 참고.

- Vercel serverless → VPS / Docker 전환 (yt-dlp 바이너리 실행 환경 필요)
- TLS 핑거프린팅 우회를 위한 `curl-cffi` + `yt-dlp --impersonate chrome`
- Python HTML fetcher 데몬 풀 (시동 비용 제거 + 동시성 유지)
- 다층 차단 완화 (impersonation → 쿠키 → 프록시)
