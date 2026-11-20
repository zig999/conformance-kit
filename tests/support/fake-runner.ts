import type { ICommand, ICommandResult, ICommandRunner } from '../../src/shared/ports.js';

export type CommandHandler = (
  command: ICommand,
  calls: readonly ICommand[],
) => ICommandResult | Promise<ICommandResult>;

export const succeeded = (output = ''): ICommandResult => ({ exitCode: 0, output, stdout: output, timedOut: false });
export const failed = (exitCode = 1, output = ''): ICommandResult => ({
  exitCode,
  output,
  stdout: output,
  timedOut: false,
});
/** A command that succeeds and says something on stderr only, such as a warning of docker compose. */
/** A command that ran out of time and was killed. */
export const timedOut = (): ICommandResult => ({ exitCode: 130, output: '', stdout: '', timedOut: true });

export const succeededWithWarning = (warning: string): ICommandResult => ({
  exitCode: 0,
  output: warning,
  stdout: '',
  timedOut: false,
});

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
