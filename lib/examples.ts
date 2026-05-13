export type TabId = "lookup" | "unique-url" | "download";

export interface TabExamples {
  title: string;
  description: string;
  items: string[];
}

export const EXAMPLES: Record<TabId, TabExamples> = {
  lookup: {
    title: "크리에이터 조회 예시",
    description: "TikTok 프로필 URL 또는 @handle (혼합 입력 가능)",
    items: [
      "@charlidamelio",
      "https://www.tiktok.com/@khaby.lame",
      "@bellapoarch",
      "https://www.tiktok.com/@mrbeast",
      "@therock",
      "https://www.tiktok.com/@selenagomez",
      "@kimkardashian",
      "https://www.tiktok.com/@kyliejenner",
    ],
  },
  "unique-url": {
    title: "고유주소 추출 예시",
    description: "핸들이 바뀌어도 변하지 않는 숫자ID 기반 주소로 변환 (핸들/풀 URL 혼합 입력 가능)",
    items: [
      "@charlidamelio",
      "https://www.tiktok.com/@khaby.lame",
      "@bellapoarch",
      "https://www.tiktok.com/@mrbeast",
      "@therock",
      "https://www.tiktok.com/@selenagomez",
      "@kimkardashian",
      "https://www.tiktok.com/@kyliejenner",
    ],
  },
  download: {
    title: "영상 다운로드 예시",
    description: "공개 TikTok 영상 URL (실패한 영상은 자동 제외 후 ZIP)",
    items: [
      "https://www.tiktok.com/@tete/video/7634766160579284244",
      "https://www.tiktok.com/@tete/video/7634025436162297109",
      "https://www.tiktok.com/@tete/video/7633188680957463815",
      "https://www.tiktok.com/@tete/video/7628504023988980999",
      "https://www.tiktok.com/@tete/video/7627027266240892167",
      "https://www.tiktok.com/@tete/video/7624765325074074898",
      "https://www.tiktok.com/@tete/video/7621710345706507527",
      "https://www.tiktok.com/@tete/video/7620675662453476629",
      "https://www.tiktok.com/@bp_tiktok/video/7611406406461164807",
      "https://www.tiktok.com/@bp_tiktok/photo/7628881771513318674",
      "https://www.tiktok.com/@bp_tiktok/video/7615170396400258311",
      "https://www.tiktok.com/@bp_tiktok/video/7615162651173293320",
      "https://www.tiktok.com/@bp_tiktok/video/7613686124007017735",
      "https://www.tiktok.com/@bp_tiktok/video/7613678380675894536",
      "https://www.tiktok.com/@bp_tiktok/video/7613662836157435144",
      "https://www.tiktok.com/@bp_tiktok/video/7611745540673441032",
      "https://www.tiktok.com/@bp_tiktok/video/7610075718197792018",
      "https://www.tiktok.com/@bp_tiktok/photo/7608894024384056584",
      "https://www.tiktok.com/@bp_tiktok/video/7601061406653435143",
      "https://www.tiktok.com/@bp_tiktok/video/7598463745995722002",
      "https://www.tiktok.com/@bp_tiktok/video/7595232308572114184",
      "https://www.tiktok.com/@bp_tiktok/video/7580249645134138632",
      "https://www.tiktok.com/@bp_tiktok/video/7577637461589871880",
      "https://www.tiktok.com/@bp_tiktok/video/7564324618635431175",
    ],
  },
};
