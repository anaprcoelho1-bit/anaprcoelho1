/** Abre links externos em nova aba; links do próprio tenant abrem na mesma aba. */
export function linkTarget(url: string | undefined): { target?: string; rel?: string } {
  if (!url || url.charAt(0) === '/' || url.charAt(0) === '#') {
    return {};
  }
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.host === window.location.host ? {} : { target: '_blank', rel: 'noopener noreferrer' };
  } catch {
    return {};
  }
}

/** Divide um texto de várias linhas em linhas não vazias. */
export function lines(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
