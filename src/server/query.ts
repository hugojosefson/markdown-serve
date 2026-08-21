type QueryItem = { key: string; value: string | undefined; index: number };

export function canonicalQuery(search: string): string {
  const items = search.replace(/^\?/, "").split("&").filter(Boolean).map(
    (item, index) => {
      const equals = item.indexOf("=");
      return {
        key: decode(equals < 0 ? item : item.slice(0, equals)),
        value: equals < 0 ? undefined : decode(item.slice(equals + 1)),
        index,
      };
    },
  );
  items.sort((left, right) =>
    lexical(left.key, right.key) ||
    lexical(left.value ?? "", right.value ?? "") || left.index - right.index
  );
  return items.map(({ key, value }) =>
    `${encodeURIComponent(key)}${
      value === undefined ? "" : `=${encodeURIComponent(value)}`
    }`
  ).join("&");
}

export function queryHref(pathname: string, search: string): string {
  const query = canonicalQuery(search);
  return query ? `?${query}` : pathname;
}

export function retainQuery(search: string, keys: readonly string[]): string {
  const retained = new Set(keys);
  return canonicalQuery(
    search.replace(/^\?/, "").split("&").filter(Boolean).filter((item) =>
      retained.has(decode(item.split("=", 1)[0]))
    ).join("&"),
  );
}

export function setQuery(
  search: string,
  key: string,
  value: string | null | undefined,
): string {
  const items = search.replace(/^\?/, "").split("&").filter(Boolean).filter((
    item,
  ) => decode(item.split("=", 1)[0]) !== key);
  if (value !== undefined) {
    items.push(
      value === null
        ? encodeURIComponent(key)
        : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    );
  }
  return canonicalQuery(items.join("&"));
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " "));
  } catch {
    return value;
  }
}

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
