/** Example eucalypt programs for the playground. */

export interface Example {
  name: string;
  source: string;
  format: string;
  /** Parse mode: "unit" (declarations, default) or "expr" (expression). */
  mode?: "unit" | "expr";
}

export const EXAMPLES: Example[] = [
  {
    name: "Hello World",
    format: "yaml",
    source: `hello: "world"`,
  },
  {
    name: "List Operations",
    format: "yaml",
    source: `numbers: [1, 2, 3, 4, 5]

doubled: numbers map(* 2)

total: numbers foldl(+, 0)

first-three: numbers take(3)`,
  },
  {
    name: "String Processing",
    format: "json",
    source: `greeting: "Hello, Eucalypt!"

upper: greeting str.to-upper

lower: greeting str.to-lower

words: greeting str.split-on(" ")`,
  },
  {
    name: "Block Merging",
    format: "yaml",
    source: `\` "Defaults for a service."
base: { name: "web" db: { host: "localhost" port: 5432 } }

\` "Settings to lay over the defaults."
patch: { db: { host: "db.prod" } }

# Shallow: patch's db replaces base's db whole. There is no
# shallow-merge operator: catenation is the shallow merge.

\` "Shallow merge by block catenation."
shallow-cat: base patch

\` "Shallow merge with the merge function."
shallow-fn: merge(base, patch)

# Deep: nested blocks merge too, so db keeps its port.
# Catenation is always shallow.

\` "Deep merge with the << operator."
deep-op: base << patch

\` "Deep merge with the deep-merge function."
deep-fn: deep-merge(base, patch)`,
  },
  {
    name: "Functions",
    format: "yaml",
    source: `square(n): n * n

cube(n): n * n * n

results: [1, 2, 3, 4, 5] map(square)

cubes: [1, 2, 3] map(cube)`,
  },
  {
    name: "Conditionals",
    format: "yaml",
    source: `temperature: 23

\` "then: a two-way choice, piped from a boolean."
weather: (temperature > 20) then("warm", "cool")

\` "if: the same two-way choice, as a function call."
coat: if(temperature < 10, "heavy", "light")

\` "cond: three or more branches; the last item is the default."
grade(score): cond[score >= 90 => "A", score >= 80 => "B", score >= 70 => "C", "F"]

grades: [95, 82, 65, 91, 73] map(grade)`,
  },
  {
    name: "Data Transformation",
    format: "json",
    source: `items: ["apple", "banana", "cherry", "date"]

n: items count

reversed: items reverse

first: items head

rest: items tail`,
  },
  {
    name: "String Interpolation",
    format: "text",
    mode: "expr",
    source: `{
  name: "world"
  result: "Hello, {name}!"
}.result`,
  },
  {
    name: "Map and Filter Pipelines",
    format: "yaml",
    source: `numbers: range(1, 11)

\` "Keep the odd numbers, then square each one."
odd-squares: numbers filter(_ % 2 = 1) map(_0 * _0)

\` "mapcat maps each item to a list and joins the lists."
letters: ["ab", "cd"] mapcat(str.letters)

\` "Steps run left to right: filter, map, then sum."
total: numbers filter(> 5) map(* 10) sum`,
  },
  {
    name: "Type Annotations",
    format: "yaml",
    source: `\` { type: "number → number" }
double(x): x * 2

\` { type: "[number] → number" }
total(xs): xs foldl(+, 0)

result: [1, 2, 3] map(double) total`,
  },
  {
    name: "Safe Navigation",
    format: "yaml",
    source: `data: {server: {host: "localhost" port: 8080}}

host: data ~ :server ~ :host

port: data ~ :server ~ :port

missing: data ~ :server ~ :timeout

deep-miss: data ~ :cache ~ :ttl`,
  },
  {
    name: "Lenses",
    format: "yaml",
    source: `{ import: "lens.eu" }

config: { server: { db: { host: "localhost" port: 5432 } } }

\` "Read a nested value through a lens."
host: config view(‹:server :db :host›)

\` "Transform the value; the whole structure comes back."
bumped: config over(‹:server :db :port›, + 1)

\` "Replace the value: -> ignores the old one."
moved: config over(‹:server :db :host›, -> "db.prod")`,
  },
  {
    name: "Monads",
    format: "yaml",
    source: `{ import: "state.eu" }

\` "A :for block gives every combination of its lists."
sizes: { :for size: [:s, :m] hue: [:red, :blue] }.("{size}-{hue}")

\` { doc: "A :random block threads the random stream."
    export: :suppress }
dice: { :random
  d6: random.int(6)
  d20: random.int(20)
}.[d6 + 1, d20 + 1]

\` "Run the action from a fixed seed and take its value."
rolls: dice(random.stream(42)).value

\` { doc: "A :state block threads a state block."
    export: :suppress }
tick: { :state
  n: state.query(_.count)
  _: state.modify(:count, + 1)
}.(n)

\` "Run the action from a starting state and take its value."
seen: state.eval(tick, { count: 41 })

\` "The state the action leaves behind."
after: state.run(tick, { count: 41 }).state`,
  },
];
