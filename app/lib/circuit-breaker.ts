import { BusinessError } from "@/app/lib/business-error";

export interface UpstreamBreakerOptions {
  /** 连续失败多少次后打开熔断，默认 3。 */
  threshold?: number;
  /** 熔断打开后的冷却时长（毫秒），默认 30s。 */
  cooldownMs?: number;
  /** 注入时钟，便于测试。 */
  now?: () => number;
}

interface BreakerState {
  consecutiveFailures: number;
  openUntil: number;
}

/**
 * 极轻量的「上游熔断器」。
 *
 * 解决的具体问题：上游整站不可达时（例如从部署环境出网到源站被静默丢包），
 * 每个请求都会老老实实等满 `单次超时 × 重试次数`，白白烧掉 serverless 执行时间，
 * 访客端也要多等好几秒。这里在连续失败到阈值后进入冷却期，
 * 冷却期内的请求直接抛 503 快速失败。
 *
 * 状态按 key（通常是上游 host）隔离；进程内共享。serverless 多实例时各自独立，
 * 在本场景可接受 —— 它只是「止损」，不追求精确的可用性统计。
 */
export class UpstreamBreaker {
  private readonly states = new Map<string, BreakerState>();

  private readonly threshold: number;

  private readonly cooldownMs: number;

  private readonly now: () => number;

  constructor(options: UpstreamBreakerOptions = {}) {
    this.threshold = options.threshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  private stateFor(key: string): BreakerState {
    let state = this.states.get(key);
    if (!state) {
      state = { consecutiveFailures: 0, openUntil: 0 };
      this.states.set(key, state);
    }
    return state;
  }

  isOpen(key: string): boolean {
    return this.stateFor(key).openUntil > this.now();
  }

  /** 熔断打开时抛 BusinessError(503)，调用方据此快速失败。 */
  assertClosed(key: string, label = key): void {
    if (this.isOpen(key)) {
      throw new BusinessError(`上游 ${label} 连续失败，已暂停请求`, 503);
    }
  }

  recordSuccess(key: string): void {
    const state = this.stateFor(key);
    state.consecutiveFailures = 0;
    state.openUntil = 0;
  }

  recordFailure(key: string): void {
    const state = this.stateFor(key);
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= this.threshold) {
      state.consecutiveFailures = 0;
      state.openUntil = this.now() + this.cooldownMs;
    }
  }
}
