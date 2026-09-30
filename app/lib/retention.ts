/**
 * 时间序列表的保留期。清理点在 app/api/stats/record/route.ts 的 cleanIfDue，
 * 查询侧（如仪表盘「最近访客」）必须用同一个窗口，否则两边会悄悄漂移。
 */
export const DAILY_UV_RETENTION_DAYS = 7;
/** 登录日志没有别的清理点，不设保留期会无限增长。 */
export const LOGIN_LOG_RETENTION_DAYS = 180;
export const VISITOR_LOG_RETENTION_DAYS = 30;

export function retentionCutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}
