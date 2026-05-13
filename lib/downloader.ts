import { exec, execSync } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

const DOWNLOAD_BASE = path.join(process.cwd(), "downloads");
const NODE_PATH = path.join(
  process.env.HOME || "~",
  ".nvm/versions/node/v24.13.1/bin/node"
);

interface TaskState {
  status: "downloading" | "done" | "failed";
  total: number;
  completed: number;
  errors: { index: number; url: string; error: string }[];
  zipPath?: string;
  errorMessage?: string;
}

const g = globalThis as unknown as { __tiktokDownloadTasks?: Map<string, TaskState> };
if (!g.__tiktokDownloadTasks) {
  g.__tiktokDownloadTasks = new Map<string, TaskState>();
}
const tasks = g.__tiktokDownloadTasks;

function humanizeYtDlpError(e: unknown): string {
  const msg = String(e);
  if (msg.includes("Your IP address is blocked")) {
    return "TikTok이 이 영상을 일시적으로 차단했거나, 영상이 더 이상 사용할 수 없는 상태입니다. 잠시 후 다시 시도해주세요.";
  }
  if (msg.includes("Video unavailable") || msg.includes("removed by")) {
    return "이 영상은 더 이상 사용할 수 없습니다 (삭제 또는 비공개).";
  }
  if (msg.includes("HTTP Error 404")) {
    return "영상을 찾을 수 없습니다.";
  }
  if (msg.includes("HTTP Error 403")) {
    return "TikTok이 접근을 거부했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (msg.includes("age restricted") || msg.includes("Sign in to confirm")) {
    return "연령 제한 또는 로그인이 필요한 영상입니다.";
  }
  if (msg.includes("Unable to extract")) {
    return "영상 정보를 가져오지 못했습니다.";
  }
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return "응답이 너무 오래 걸립니다. 잠시 후 다시 시도해주세요.";
  }
  return "다운로드 실패 (알 수 없는 오류)";
}

export function createTaskId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function getTaskStatus(taskId: string): TaskState | null {
  return tasks.get(taskId) || null;
}

export function getZipPath(taskId: string): string {
  return path.join(DOWNLOAD_BASE, `${taskId}.zip`);
}

interface DownloadItem {
  index: number;
  url: string;
  platform: string;
  username: string;
}

function sanitizeFilename(name: string): string {
  // NFC 정규화: macOS NFD → Windows NFC (한글 깨짐 방지)
  let sanitized = name.normalize("NFC");
  sanitized = sanitized.replace(/[<>:"/\\|?*]/g, "_").replace(/^[. ]+|[. ]+$/g, "");
  return sanitized;
}

// zero-pad: 총 개수에 따라 자릿수 자동 맞춤
function zeroPad(num: number, total: number): string {
  const digits = String(total).length;
  return String(num).padStart(digits, "0");
}

function buildFilename(template: string, item: DownloadItem & { nickname?: string; userId?: string }, total: number): string {
  let filename = template;
  filename = filename.replace(/\{number\}/g, zeroPad(item.index, total));
  filename = filename.replace(/\{tiktok_id\}/g, item.userId || item.username || "");
  filename = filename.replace(/\{nickname\}/g, item.nickname || "");
  return sanitizeFilename(filename);
}

function getYtdlpEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const nodeDir = path.dirname(NODE_PATH);
  if (fs.existsSync(NODE_PATH)) {
    env.PATH = `${nodeDir}:${env.PATH}`;
  }
  return env;
}

async function downloadSingle(
  url: string,
  tempOutputPath: string
): Promise<{ success: boolean; userId?: string; nickname?: string; error?: string }> {
  if (/\/photo\/\d+/.test(url)) {
    return { success: false, error: "사진(photo) 게시물은 영상 다운로드 대상이 아닙니다." };
  }

  const cookieOpts: string[] = [];
  const cookiesFile = process.env.TIKTOK_COOKIES_FILE;
  const cookiesBrowser = process.env.TIKTOK_COOKIES_BROWSER;
  if (cookiesFile) cookieOpts.push("--cookies", `"${cookiesFile}"`);
  else if (cookiesBrowser) cookieOpts.push("--cookies-from-browser", cookiesBrowser);

  const cmd = [
    "yt-dlp",
    "--print-json",
    "-o", `"${tempOutputPath}.%(ext)s"`,
    "--format", '"bv*+ba/b/best"',
    "--merge-output-format", "mp4",
    ...cookieOpts,
    "--no-playlist",
    "--quiet",
    "--no-warnings",
    `"${url}"`,
  ].join(" ");

  try {
    const { stdout } = await execAsync(cmd, {
      encoding: "utf-8",
      timeout: 300000,
      env: getYtdlpEnv(),
      maxBuffer: 10 * 1024 * 1024,
    });

    const lines = stdout.trim().split("\n").filter(Boolean);
    const lastLine = lines[lines.length - 1];
    let userId = "";
    let nickname = "";
    try {
      const info = JSON.parse(lastLine);
      userId = info.uploader || info.uploader_id || "";
      nickname = info.creator || info.channel || "";
    } catch { /* ignore */ }

    return { success: true, userId, nickname };
  } catch (e) {
    return { success: false, error: humanizeYtDlpError(e) };
  }
}

export function parseTiktokUrls(text: string): DownloadItem[] {
  const results: DownloadItem[] = [];
  const lines = text.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("tiktok.com")) continue;

    // TikTok: 쿼리 파라미터 전부 제거
    let cleanedUrl = trimmed;
    try {
      const parsed = new URL(trimmed);
      parsed.search = "";
      cleanedUrl = parsed.toString();
    } catch { /* 원본 사용 */ }

    const usernameMatch = trimmed.match(/@([^/]+)/);
    results.push({
      index: results.length + 1,
      url: cleanedUrl,
      platform: "tiktok",
      username: usernameMatch ? usernameMatch[1] : "",
    });
  }

  return results;
}

export async function downloadAll(
  items: DownloadItem[],
  taskId: string,
  template: string,
  skipMetadata: boolean
) {
  const taskDir = path.join(DOWNLOAD_BASE, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.mkdirSync(DOWNLOAD_BASE, { recursive: true });

  const total = items.length;
  const needMetadata = !skipMetadata && !!template;

  const task: TaskState = {
    status: "downloading",
    total,
    completed: 0,
    errors: [],
  };
  tasks.set(taskId, task);

  const maxWorkers = 3;
  let running = 0;
  let idx = 0;

  await new Promise<void>((resolve) => {
    function next() {
      if (idx >= items.length && running === 0) {
        resolve();
        return;
      }

      while (running < maxWorkers && idx < items.length) {
        const item = items[idx++];
        running++;

        const tempName = `_temp_${item.index}`;
        const tempOutputPath = path.join(taskDir, tempName);

        downloadSingle(item.url, tempOutputPath)
          .then((result) => {
            task.completed++;

            if (!result.success) {
              task.errors.push({ index: item.index, url: item.url, error: result.error || "다운로드 실패" });
            } else {
              const files = fs.readdirSync(taskDir).filter((f) => f.startsWith(tempName + "."));
              if (files.length > 0) {
                const downloadedFile = path.join(taskDir, files[0]);
                const ext = path.extname(downloadedFile);

                let finalName: string;
                if (needMetadata) {
                  finalName = buildFilename(template, { ...item, userId: result.userId, nickname: result.nickname }, total) + ext;
                } else {
                  finalName = String(item.index) + ext;
                }
                fs.renameSync(downloadedFile, path.join(taskDir, finalName));
              }
            }

            running--;
            next();
          })
          .catch(() => {
            task.completed++;
            task.errors.push({ index: item.index, url: item.url, error: "예기치 않은 오류" });
            running--;
            next();
          });
      }
    }

    next();
  });

  const filesInDir = fs
    .readdirSync(taskDir)
    .filter((f) => !f.startsWith("_temp_") && fs.statSync(path.join(taskDir, f)).isFile())
    .sort();

  if (filesInDir.length === 0) {
    task.status = "failed";
    task.errorMessage = "다운로드에 성공한 파일이 없습니다.";
  } else {
    const zipPath = getZipPath(taskId);
    try {
      execSync(`cd "${taskDir}" && zip -0 -j "${zipPath}" ${filesInDir.map((f) => `"${f}"`).join(" ")}`, { timeout: 60000 });
      task.status = "done";
      task.zipPath = zipPath;
    } catch {
      task.status = "failed";
      task.errorMessage = "ZIP 압축 실패";
    }
  }

  fs.rmSync(taskDir, { recursive: true, force: true });
}
