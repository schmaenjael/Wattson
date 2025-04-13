export class UInt8 {
  private value: number;
  [key: number]: 0 | 1;

  constructor(value: number = 0) {
    this.value = value;

    return new Proxy(this, {
      get: (target, prop) => {
        const bit = Number(prop);
        if (!isNaN(bit) && bit >= 0 && bit < 8) {
          return target.getBit(bit);
        }
        return target[prop as keyof UInt8];
      },
      set: (target, prop, n: 0 | 1) => {
        const bit = Number(prop);
        if (!isNaN(bit) && bit >= 0 && bit < 8) {
          target.setBit(bit, n);
          return true;
        }
        return false;
      },
    });
  }

  public getBit(bit: number): 0 | 1 {
    return (this.value & (1 << bit)) !== 0 ? 1 : 0;
  }

  public toString(): string {
    return this.value.toString(2).padStart(8, '0');
  }

  protected setBit(bit: number, n: 0 | 1): void {
    if (n == 1) this.value |= 1 << bit;
    else this.value &= ~(1 << bit);
  }
}
