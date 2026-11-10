import { onUnmounted } from "vue";

export const SERVICE_HEALTH_POLL_INTERVAL_MS = 60_000;

export function useServiceHealthPolling(checkHealth: () => void | Promise<void>) {
  let timer: ReturnType<typeof setInterval> | undefined;

  function start() {
    if (timer) return;
    timer = setInterval(() => void checkHealth(), SERVICE_HEALTH_POLL_INTERVAL_MS);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = undefined;
  }

  onUnmounted(stop);
  return { start, stop };
}
