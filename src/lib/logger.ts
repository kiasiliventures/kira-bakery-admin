type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
};

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    meta,
  };
  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.info(serialized);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) =>
    log("error", message, meta),
};

