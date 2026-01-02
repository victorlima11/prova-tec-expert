export const stageColors = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6", "#14b8a6"]

export function getStageColor(index: number) {
  return stageColors[index % stageColors.length]
}
