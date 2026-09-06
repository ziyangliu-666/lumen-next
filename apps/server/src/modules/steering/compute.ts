// Strategy + Null Object for the compute backend. The domain never learns which
// provider is live, and "none" is a real object that returns a readable failure
// rather than a null the callers must guard.
export interface CommandResult {
  readonly stdout: string;
  readonly exitCode: number;
}

export interface Compute {
  readonly name: string;
  run(command: string): Promise<CommandResult>;
}

export class NullCompute implements Compute {
  readonly name = 'none';
  run(_command: string): Promise<CommandResult> {
    return Promise.resolve({
      stdout: 'No compute provider is configured. Set LUMEN_COMPUTE to enable `run`.',
      exitCode: 127,
    });
  }
}
