export function nicknameToEmail(nickname: string): string {
  const slug = nickname.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) throw new Error('Nickname tidak valid');
  return `${slug}@santri.rm6.internal`;
}

export function isValidNickname(nickname: string): boolean {
  const trimmed = nickname.trim();
  if (trimmed.length < 3 || trimmed.length > 20) return false;
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  return slug.length >= 3;
}
