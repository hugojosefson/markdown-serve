import config from "../../deno.json" with { type: "json" };

export const version: string = config.version;
