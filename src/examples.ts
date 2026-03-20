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
  evens: numbers filter(even?)
  total: numbers foldl(+, 0)
}`,
  },
  {
    name: "String Processing",
    format: "json",
    source: `{
  greeting: "Hello, Eucalypt!"
  upper: greeting str.upper
  lower: greeting str.lower
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
  fizzbuzz: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    map(if((% 15) = 0, "FizzBuzz", if((% 3) = 0, "Fizz", if((% 5) = 0, "Buzz", str))))
}`,
  },
  {
    name: "Data Transformation",
    format: "json",
    source: `{
  people: [
    { name: "Alice" age: 30 }
    { name: "Bob"   age: 25 }
    { name: "Carol" age: 35 }
  ]
  names: people map(.name)
  adults: people filter(.age >= 18)
  oldest: people foldl((a b): if(a.age > b.age, a, b), head(people))
}`,
  },
  {
    name: "Text Output",
    format: "text",
    source: `"The answer is {42}"`,
  },
];
