/**
 * The homepage's eucalypt. Outputs are not written here: the engine
 * produces them when the site is built (src/site/engine.ts). The snippets
 * that need the command line (files, imports, warnings) carry the output
 * `eu` printed for them, checked against the pinned revision.
 */

export interface HeroExample {
  id: string;
  label: string;
  file: string;
  source: string;
  /** The example is an error to find, not output to show. */
  fails?: boolean;
}

/** The hero editor's examples, in picker order; the first opens first. */
export const HERO: HeroExample[] = [
  {
    id: "layers",
    label: "Layer configs",
    file: "layers.eu",
    source: `service(overrides): {
  name: "ledger"
  replicas: 2
  db: { host: "db.internal" port: 5432 pool: 10 }
} << overrides

staging: service{ db: { host: "db.staging" } }
production: service{ replicas: 6 db: { pool: 40 } }`,
  },
  {
    id: "pipelines",
    label: "Pipelines",
    file: "pipelines.eu",
    source: `\` :suppress
people: [
  { name: "ada" team: :core score: 92 },
  { name: "brendan" team: :web score: 71 },
  { name: "grace" team: :core score: 88 }
]

leaders: people filter(_.score > 80) map(_.name str.to-upper)`,
  },
  {
    id: "generate",
    label: "Generate",
    file: "generate.eu",
    source: `service(n): {
  name: "web-{n}"
  port: 8080 + n
  tier: (n = 0) then(:primary, :replica)
}

services: range(0, 3) map(service)`,
  },
  {
    id: "error",
    label: "Find the error",
    file: "ports.eu",
    fails: true,
    source: `ports: { http: 80 https: 443 }

# One of these keys is misspelt: the error says which.
open: [ports.http, ports.htps]`,
  },
  {
    id: "strings",
    label: "Strings",
    file: "strings.eu",
    source: `user: { name: "ada" id: 7 }
greeting: "Hello, {user.name}! You are user #{user.id:%03d}."`,
  },
  {
    id: "infinite",
    label: "Infinite lists",
    file: "powers.eu",
    source: `\` "An infinite list, evaluated only as far as it is needed."
powers: iterate(* 2, 1) take(8)`,
  },
];

/** "A short tour": six ideas, each a line or two. */
export const TOUR = [
  { title: "Pipelines", key: "catenation", source: "last: [1, 2, 3, 4, 5] reverse head" },
  { title: "Anaphora", key: "_0, {}", source: 'squares: [1, 2, 3, 4] map(_0 * _0)\nlabels: [:a, :b] map("item-{}")' },
  {
    title: "Interpolation",
    key: '"{x:%03d}"',
    source: 'user: { name: "ada" id: 7 }\ngreeting: "Hello, {user.name}! You are user #{user.id:%03d}."',
  },
  { title: "Deep merge", key: "<<", source: 'merged: { db: { host: "localhost" port: 5432 } }\n  << { db: { host: "db.prod" } }' },
  { title: "Destructuring", key: "f{w h}", source: "area{w h}: w * h\nroom: area{w: 4 h: 3}" },
  {
    title: "Inline tests",
    key: "//=>",
    source: 'slug(s): s str.to-lower str.replace(" +", "-")\n\ntitle: "Hello Gum Trees" slug //=> "hello-gum-trees"',
  },
];

/** Snippets run with the `eu` command line; outputs as `eu` printed them. */
export const CLI = {
  embedSource: `region: eu-west-1
buckets: !eu '["logs", "assets"] map("{region}-{}")'`,
  embedOutput: `region: eu-west-1
buckets:
  - eu-west-1-logs
  - eu-west-1-assets`,
  csv: `name,team,hours
ada,core,38
brendan,web,22
grace,core,41`,
  hoursSource: `{ import: "rows=staff.csv" }

hours: rows group-by(_.team) map-values(map(_.hours num) ; sum)`,
  hoursOutput: `hours:
  core: 79
  web: 22`,
  shell: `$ eu -j rows=staff.csv -e 'rows filter(_.team = "core") map(.name)'`,
  shellOutput: `[
  "ada",
  "grace"
]`,
  typesSource: `\` { type: "number -> string" }
port-label(n): "port {n}"

label: port-label("8080")`,
  typesWarning: `warning: type mismatch calling 'port-label'
  ┌─ types.eu:4:19
  │
4 │ label: port-label("8080")
  │                   ^^^^^^ expected number, found "8080"`,
};

/** The lazy pillar's snippet, evaluated at build time. */
export const LAZY = HERO.find((e) => e.id === "infinite")!.source;
