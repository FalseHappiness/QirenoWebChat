/**
 * 简易内存缓存（支持滑动过期）
 */
export class TTLCache {
  private _store: Map<string, { value: string; expire: number }> = new Map();
  private readonly ttl: number;
  private _lock: Promise<void> = Promise.resolve();

  constructor(ttl: number = 300) {
    this.ttl = ttl;
  }

  async get(key: string): Promise<string | null> {
    // 简单的互斥锁模拟
    await this._lock;
    const entry = this._store.get(key);
    if (entry && Date.now() < entry.expire) {
      // 命中即续期（滑动过期）
      entry.expire = Date.now() + this.ttl * 1000;
      return entry.value;
    }
    // 过期或不存在则清理
    if (entry) {
      this._store.delete(key);
    }
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    await this._lock;
    this._store.set(key, {
      value,
      expire: Date.now() + this.ttl * 1000,
    });
  }
}