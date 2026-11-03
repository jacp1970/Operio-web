import { WorkOrderTimer } from '../types';

/**
 * Formats a given number of seconds into HH:MM:SS format
 * E.g. 3665 -> "01:01:05"
 */
export const formatSecondsToHMS = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Formats seconds into a human-friendly string (e.g. "2h 15m", "45 min", "10 s")
 */
export const formatSecondsToHuman = (totalSeconds: number): string => {
  const sec = Math.max(0, Math.floor(totalSeconds));
  if (sec === 0) return '0 min';

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
};

/**
 * Computes the real-time elapsed seconds from a WorkOrderTimer object,
 * accounting for both accumulated totalSeconds and active running session if any.
 */
export const computeLiveTimerSeconds = (timer?: WorkOrderTimer): number => {
  if (!timer) return 0;
  const base = timer.totalSeconds || 0;
  if (!timer.isRunning || !timer.activeStartedAt) {
    return base;
  }

  const startTime = new Date(timer.activeStartedAt).getTime();
  if (isNaN(startTime)) return base;

  const now = Date.now();
  const activeElapsed = Math.max(0, Math.floor((now - startTime) / 1000));
  return base + activeElapsed;
};
