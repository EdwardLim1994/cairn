const applicationOrigin = "http://cairn.local";

export function safeLocalReturnPath(value: unknown): string {
  const hasControlCharacter =
    typeof value === "string" &&
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    hasControlCharacter
  ) {
    return "/";
  }

  const destination = new URL(value, applicationOrigin);
  if (destination.origin !== applicationOrigin || destination.pathname === "/login") return "/";
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
