import { after } from "next/server";

export function runAfterResponse(task: () => Promise<void> | void) {
  try {
    after(task);
  } catch {
    // Route tests and non-request contexts can run outside Next's request scope.
  }
}
