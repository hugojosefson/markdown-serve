export type CliOptions = {
  root: string;
  host: string;
  port: number;
  explicitPort: boolean;
  redirectStatus: 301 | 302;
  reload: boolean;
  open: boolean;
  edit?: boolean;
};

export type Command = { kind: "help" | "version" } | {
  kind: "serve";
  options: CliOptions;
};
