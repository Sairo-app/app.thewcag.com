export class LatestRequest<T> {
  private version = 0;
  private latestResult: Promise<T | null> = Promise.resolve(null);

  run(
    load: () => Promise<T>,
    apply: (value: T) => void,
  ): Promise<T | null> {
    const requestVersion = ++this.version;
    const result = load().then((value) => {
      if (requestVersion !== this.version) return this.latestResult;
      apply(value);
      return value;
    });
    this.latestResult = result;
    return result;
  }

  invalidate(): void {
    this.version += 1;
    this.latestResult = Promise.resolve(null);
  }
}
