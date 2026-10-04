const STATIC_IMAGE_HOSTS = [
  "avatars.githubusercontent.com",
  "api.dicebear.com",
] as const;

export const OPTIMIZABLE_IMAGE_HOSTS: readonly string[] = [...STATIC_IMAGE_HOSTS];

export const IMAGE_REMOTE_PATTERNS = OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
  protocol: "https" as const,
  hostname,
}));
