import { z } from "zod";
export const inputAwareDateTime = () => z.preprocess((val) => {
  if (typeof val !== "string" || !val) return val;
  // datetime-local gives "2025-03-18T14:30" — append Z to satisfy .datetime()
  return val.length === 16 ? `${val}:00.000Z` : val;
}, z.string().datetime());