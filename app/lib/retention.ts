export const DAILY_UV_RETENTION_DAYS = 7;
export const LOGIN_LOG_RETENTION_DAYS = 180;
export const VISITOR_LOG_RETENTION_DAYS = 30;

export function retentionCutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}
