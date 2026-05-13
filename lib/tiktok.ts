import { exec } from "child_process";
import { promisify } from "util";
import { fetchHtml } from "./htmlDaemon";
import type { CreatorProfile, VideoInfo, ProgressEvent } from "./types";

const execAsync = promisify(exec);

function cookiesArgs(): string {
  const file = process.env.TIKTOK_COOKIES_FILE;
  if (file) return `--cookies "${file}"`;
  const browser = process.env.TIKTOK_COOKIES_BROWSER;
  if (browser) return `--cookies-from-browser ${browser}`;
  return "";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUsername(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) return trimmed.slice(1);
  const match = trimmed.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);
  return match ? match[1] : null;
}

export function extractUsernames(inputs: string[]): string[] {
  const usernames = inputs.map(extractUsername).filter(Boolean) as string[];
  return [...new Set(usernames)];
}

type ProfileCore = Omit<CreatorProfile, "url" | "uniqueUrl" | "recentVideos" | "lastPostDate"> & {
  userId: string;
};

async function fetchProfileFromHtml(username: string): Promise<ProfileCore | null> {
  const html = await fetchHtml(`https://www.tiktok.com/@${username}`);

  const scriptMatch = html.match(
    new RegExp('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\\s\\S]*?)</script>')
  );
  if (!scriptMatch) return null;

  const userInfo = JSON.parse(scriptMatch[1])?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"]?.userInfo;
  if (!userInfo) return null;

  const user = userInfo.user;
  const stats = userInfo.stats;
  const bio = (user.signature || "") as string;
  const emailMatch = bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

  return {
    username: user.uniqueId as string,
    nickname: user.nickname as string,
    avatar: (user.avatarLarger || user.avatarMedium || user.avatarThumb || "") as string,
    followerCount: (stats.followerCount || 0) as number,
    followingCount: (stats.followingCount || 0) as number,
    heartCount: (stats.heartCount || stats.heart || 0) as number,
    videoCount: (stats.videoCount || 0) as number,
    verified: Boolean(user.verified),
    privateAccount: Boolean(user.privateAccount ?? user.secret),
    userId: (user.id || "") as string,
    bio,
    email: emailMatch ? emailMatch[0] : null,
  };
}

interface YtDlpVideoJson {
  id: string;
  title?: string;
  thumbnail?: string;
  timestamp?: number;
  thumbnails?: { id?: string; url: string }[];
}

async function runYtDlp(username: string): Promise<string> {
  const cookies = cookiesArgs();
  const { stdout, stderr } = await execAsync(
    `yt-dlp --flat-playlist --dump-json --impersonate chrome ${cookies} "https://www.tiktok.com/@${username}" --playlist-items 1:10`,
    { encoding: "utf-8", timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
  );
  if (stderr && !stdout.trim()) {
    console.error(`[yt-dlp ${username}] stderr:`, stderr.slice(0, 500));
  }
  return stdout;
}

async function fetchVideosWithYtDlp(username: string): Promise<VideoInfo[]> {
  let stdout = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      stdout = await runYtDlp(username);
      if (stdout.trim()) break;
    } catch (e) {
      const err = e as { message?: string; stderr?: string };
      console.error(`[yt-dlp ${username}] attempt ${attempt + 1} failed:`, err.message?.slice(0, 300), err.stderr?.slice(0, 300));
    }
    if (attempt === 0) await delay(1000 + Math.random() * 1000);
  }

  if (!stdout.trim()) return [];

  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const d: YtDlpVideoJson = JSON.parse(line);
        const originCover = d.thumbnails?.find((t) => t.id === "originCover")?.url;
        const cover = d.thumbnails?.find((t) => t.id === "cover")?.url;
        return {
          id: d.id,
          cover: cover || originCover || d.thumbnail || "",
          title: d.title || "",
          createTime: d.timestamp || 0,
        };
      } catch {
        return null;
      }
    })
    .filter((v): v is VideoInfo => v !== null);
}

const MAX_RETRIES = 2;

export interface UniqueUrlResult {
  username: string;
  nickname: string;
  userId: string;
  uniqueUrl: string;
}

export async function fetchUniqueUrl(username: string): Promise<UniqueUrlResult | null> {
  let profile = await fetchProfileFromHtml(username).catch(() => null);
  for (let attempt = 1; !profile && attempt <= MAX_RETRIES; attempt++) {
    await delay(1000 + Math.random() * 1000);
    profile = await fetchProfileFromHtml(username).catch(() => null);
  }
  if (!profile) return null;

  const uniqueUrl = profile.userId
    ? `https://www.tiktok.com/@${profile.userId}`
    : `https://www.tiktok.com/@${profile.username}`;

  return {
    username: profile.username,
    nickname: profile.nickname,
    userId: profile.userId,
    uniqueUrl,
  };
}

export async function fetchSingleProfile(
  username: string,
  onProgress: (event: ProgressEvent) => void
): Promise<CreatorProfile | null> {
  onProgress({ type: "status", username, step: "프로필 + 영상 조회 중..." });
  const t0 = Date.now();

  const videosPromise = fetchVideosWithYtDlp(username);

  let profile = await fetchProfileFromHtml(username).catch(() => null);
  for (let attempt = 1; !profile && attempt <= MAX_RETRIES; attempt++) {
    const waitMs = 1000 + Math.random() * 1000;
    onProgress({ type: "status", username, step: `프로필 재시도 ${attempt}/${MAX_RETRIES} (${Math.round(waitMs / 1000)}초 대기)...` });
    await delay(waitMs);
    profile = await fetchProfileFromHtml(username).catch(() => null);
  }

  const recentVideos = await videosPromise;
  const elapsedMs = Date.now() - t0;

  if (!profile) {
    onProgress({ type: "status", username, step: `프로필 실패 (${elapsedMs}ms)` });
    return null;
  }

  onProgress({
    type: "status",
    username,
    step: `완료 — 프로필 + 영상 ${recentVideos.length}개 ${elapsedMs}ms`,
  });

  const lastPostDate =
    recentVideos.length > 0 && recentVideos[0].createTime > 0
      ? new Date(recentVideos[0].createTime * 1000).toISOString()
      : null;

  return {
    ...profile,
    url: `https://www.tiktok.com/@${profile.username}`,
    uniqueUrl: profile.userId
      ? `https://www.tiktok.com/@${profile.userId}`
      : `https://www.tiktok.com/@${profile.username}`,
    recentVideos,
    lastPostDate,
  };
}
