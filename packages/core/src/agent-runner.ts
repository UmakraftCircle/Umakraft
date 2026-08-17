  private async withOverallTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`overall timeout ${this.limits.overallTimeoutMs}ms`)), this.limits.overallTimeoutMs)),
    ]);
  }
