/** Example eucalypt programs for the playground. */

export interface Example {
  name: string;
  source: string;
  format: string;
}

export const EXAMPLES: Example[] = [
  {
    name: "Hello World",
    format: "yaml",
    source: `{ hello: "world" }`,
  },
  {
    name: "List Operations",
    format: "yaml",
    source: `{
  numbers: [1, 2, 3, 4, 5]
  doubled: numbers map(* 2)
  total: numbers foldl(+, 0)
  first-three: numbers take(3)
}`,
  },
  {
    name: "String Processing",
    format: "json",
    source: `{
  greeting: "Hello, Eucalypt!"
  upper: greeting str.to-upper
  lower: greeting str.to-lower
  words: greeting str.split-on(" ")
}`,
  },
  {
    name: "Block Merging",
    format: "yaml",
    source: `{
  defaults: { colour: "blue" size: 10 }
  overrides: { size: 20 weight: "bold" }
  result: defaults merge(overrides)
}`,
  },
  {
    name: "Functions",
    format: "yaml",
    source: `{
  square(n): n * n
  cube(n): n * n * n
  results: [1, 2, 3, 4, 5] map(square)
  cubes: [1, 2, 3] map(cube)
}`,
  },
  {
    name: "Conditionals",
    format: "yaml",
    source: `{
  x: 42
  label: if(x > 100, "large", if(x > 10, "medium", "small"))
  classify(n): if(n > 0, "positive", if(n = 0, "zero", "negative"))
  signs: [-3, 0, 5, -1, 2] map(classify)
}`,
  },
  {
    name: "Data Transformation",
    format: "json",
    source: `{
  items: ["apple", "banana", "cherry", "date"]
  n: items count
  reversed: items reverse
  first: items head
  rest: items tail
}`,
  },
  {
    name: "String Interpolation",
    format: "text",
    source: `{
  name: "world"
  result: "Hello, {name}!"
}.result`,
  },
];
