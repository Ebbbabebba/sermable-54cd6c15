import { clsx, type ClassValue } from "clsx";
import { styleConflicts } from "./styleConflicts";

export function cn(...inputs: ClassValue[]) {
  const tokens = clsx(inputs).split(/\s+/).filter(Boolean);
  const result: string[] = [];
  for (const token of tokens) {
    const conflicts = styleConflicts[token] ?? [];
    for (let i = result.length - 1; i >= 0; i--) {
      if (result[i] === token || conflicts.includes(result[i])) result.splice(i, 1);
    }
    result.push(token);
  }
  return result.join(" ");
}
