export type CliOptions = {
  root: string;
  host: string;
  port: number;
  explicitPort: boolean;
  redirectStatus: 301 | 302;
  reload: boolean;
  open: boolean;
};

export type Command = { kind: "help" | "version" } | {
  kind: "serve";
  options: CliOptions;
};

export type CommandRunner = (
  command: string,
  args: string[],
) => Promise<{ success: boolean }>;
