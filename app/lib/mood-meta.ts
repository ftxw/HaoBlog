/** 说说心情的唯一真源：前台 /moments 与后台编辑器共用（键序即前台筛选器与后台选择器的展示序）。 */
export const MOOD_META: Record<string, { emoji: string; label: string }> = {
  happy: { emoji: "😄", label: "开心" },
  sad: { emoji: "😢", label: "难过" },
  angry: { emoji: "😠", label: "愤怒" },
  calm: { emoji: "😌", label: "平静" },
  tired: { emoji: "😪", label: "疲惫" },
  thinking: { emoji: "🤔", label: "思考" },
};
