export interface GenericException {
  readonly recoverable: boolean;
  toString: () => string;
  log: () => void;
}

/** Defines a recoverable exception */
export abstract class RecoverableException extends Error implements GenericException {
  public readonly recoverable: boolean = true;

  constructor(msg: string, options?: Object) {
    super(msg, options);
  }

  public abstract log(): string;
  public abstract applicationLog(): string;

  public toString(): string {
    return `${this.name}: ${this.message}`;
  }
}

/** Defines a fatal error */
export abstract class FatalException extends Error implements GenericException {
  public readonly recoverable: boolean = false;

  constructor(msg: string, options?: Object) {
    super(msg, options);
  }

  public abstract log(): string;
  public abstract applicationLog(): string;

  public toString(): string {
    return `${this.name}: ${this.message}`;
  }
}
