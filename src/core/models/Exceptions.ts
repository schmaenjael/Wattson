import { Client } from 'discord.js';

import { Logger } from '~/utilities';

/**
 * Errors are reported to the process log only. Broadcasting them into a Discord channel was removed
 * deliberately: it turned every transient API hiccup into channel noise, and it deferred the console
 * write behind Discord I/O that could itself fail.
 */
export class BotException extends Error {
  private readonly dateTime: Date;

  constructor(_client: Client, msg: string, cause?: unknown) {
    super(msg, { cause });
    this.name = 'BotException';
    this.dateTime = new Date();

    this.log();
  }

  private log(): void {
    Logger.getInstance().error(Object(this.cause), this.toString());
  }

  public toString(): string {
    return `[ERROR] at ${this.dateTime.toISOString()}; ${this.name}: ${this.message}`;
  }
}
