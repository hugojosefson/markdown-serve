type PrismPattern = RegExp | {
  alias?: string;
  greedy?: boolean;
  inside?: Record<string, PrismPattern | PrismPattern[]>;
  lookbehind?: boolean;
  pattern: RegExp;
};

type PrismGlobal = {
  languages: Record<string, Record<string, PrismPattern | PrismPattern[]>>;
};

const prism = (globalThis as typeof globalThis & { Prism?: PrismGlobal }).Prism;

if (prism) {
  const variable: PrismPattern[] = [{
    pattern: /\$(?:"(?:\\.|[^"\\])*"|[\w#@-]+)/,
    greedy: true,
  }, {
    pattern: /\$\{[^}\r\n]+\}/,
    greedy: true,
  }];

  prism.languages.routeros = {
    comment: {
      pattern: /(^[ \t]*)#.*$/m,
      lookbehind: true,
      greedy: true,
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^"\\])*"/,
      greedy: true,
      inside: { variable },
    },
    variable,
    keyword: [
      /:(?:do|else|error|for|foreach|global|if|local|onerror|retry|return|set|while)\b/i,
      /\b(?:do|else|from|in|on-error|step|to)\b(?=\s*=)/i,
      /\b(?:and|in|not|or)\b/i,
    ],
    function: [
      {
        pattern:
          /(^|[;\r\n]\s*)\/(?:[\w-]+(?:[ \t]+(?!(?:add|disable|edit|enable|export|find|get|import|print|remove|set)\b)[\w-]+)*)/im,
        lookbehind: true,
      },
      /:(?:beep|delay|deserialize|environment|execute|find|len|log|parse|pick|put|range|resolve|serialize|time|timestamp|toarray|tobool|toid|toip6?|tonum|tostr|totime|typeof)\b/i,
      /\b(?:add|disable|edit|enable|export|find|get|import|monitor-traffic|print|remove|run|set)\b/i,
    ],
    property: /\b[\w-]+(?=\s*=)/,
    boolean: /\b(?:false|nil|no|nothing|null|true|yes)\b/i,
    number: [
      /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?:\/(?:[12]?\d|3[0-2]))?\b/,
      /\b(?:[\da-f]{2}:){5}[\da-f]{2}\b/i,
      /\b0x[\da-f]+\b/i,
      /\b\d+(?:\.\d+)?(?:ms|[dhmsw])?\b/i,
    ],
    operator: /->|&&|\|\||<<|>>|!=|[<>]=?|[=~|^&+*/%!-]+/,
    punctuation: /[()[\]{},.;:$\/]/,
  };
  prism.languages.mikrotik = prism.languages.routeros;
}
