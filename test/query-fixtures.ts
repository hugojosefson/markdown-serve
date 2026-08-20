export const canonicalQueryFixtures = [
  { search: "?z=2&a=2&a&a=1&z=1", canonical: "a&a=1&a=2&z=1&z=2" },
  { search: "?b=two+words&a=%2F&a", canonical: "a&a=%2F&b=two%20words" },
  { search: "?bad=%zz&a=1", canonical: "a=1&bad=%25zz" },
] as const;
