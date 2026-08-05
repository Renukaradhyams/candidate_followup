export function formatName(name: string | null | undefined): string {
  if (!name) return '';
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
