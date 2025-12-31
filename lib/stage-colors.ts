export const stageColors = ["#2563eb", "#16a34a", "#f97316", "#ef4444", "#0ea5e9", "#9333ea", "#10b981"]

export function getStageColor(index: number) {
  return stageColors[index % stageColors.length]
}
