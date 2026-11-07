import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines conditional classes without Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
