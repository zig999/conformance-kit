import type { ICommand, ICommandResult, ICommandRunner } from '../../src/shared/ports.js';

export type CommandHandler = (
  command: ICommand,
  calls: readonly ICommand[],
) => ICommandResult | Promise<ICommandResult>;

export const succeeded = (output = ''): ICommandResult => ({ exitCode: 0, output });
export const failed = (exitCode = 1, output = ''): ICommandResult => ({ exitCode, output });

export class FakeRunner implements ICommandRunner {
  readonly calls: ICommand[] = [];

  private readonly handler: CommandHandler;

  constructor(handler: CommandHandler = () => succeeded()) {
    this.handler = handler;
  }

  async run(command: ICommand): Promise<ICommandResult> {
    this.calls.push(command);
    return this.handler(command, this.calls);
  }

  lines(): string[] {
    return this.calls.map((call) => [call.program, ...call.args].join(' '));
  }
}
