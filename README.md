# Delay Line

An n-back twist on relational reasoning training.

You are shown a set of premises. You read it and hold it. On the next screen you get a
**new** set — and a conclusion, but the conclusion belongs to the set you saw *n screens
ago*, not the one in front of you. Decide true or false, load the next set, keep going.
Sets never come back.

```
screen   1      2      3      4      5      6
set     [01]   [02]   [03]   [04]   [05]   [06]
probe           ·      01     02     03     04      ← 2-back
```

No build step, no dependencies, no back button. Open `index.html` and play.

---

## Putting it on GitHub Pages

1. Create a repository and upload everything in this folder to the repository root
   (`index.html` has to sit at the top level).
2. **Settings → Pages → Build and deployment → Deploy from a branch**, pick your branch
   and the `/ (root)` folder.
3. Wait a minute; the site appears at `https://<user>.github.io/<repo>/`.

`.nojekyll` is included so GitHub serves the files as-is.

---

## The relations

Each set is a chain of premises linking a handful of symbols. Follow the chain from one
end to the other and you get exactly one answer.

| Relation   | Reads like                                | Notes |
|------------|-------------------------------------------|-------|
| Distinction | `A is the same as B`                     | Two "same" links cancel; each "opposite" flips the result |
| Comparison  | `A is more than B`                       | A single ordering, so the ends of the chain keep it |
| Temporal    | `A is before B`                          | Same shape, on a timeline |
| Space 2D    | `A is north-east of B`                   | Eight compass directions; add the steps like moves on a map |
| Space 3D    | `A is above and north-west of B`         | The eight directions with an optional above/below — 26 in all |
| Space 4D    | `A was below and south of B`             | Space 3D plus a time axis carried by was / is / will be |

Direction words are read strictly: *north-east of* means north **and** east; *north of*
means the same longitude and further north. That keeps every composed conclusion exact.

## The scrambling

| Setting | Effect |
|---------|--------|
| Shuffle | Premises arrive in random order, so the chain has to be rebuilt |
| Mirror  | Some premises are stated from the other side — `B is south of A` |
| Negate  | Some are stated as a denial. **A denial names the exact opposite:** `is not north of` means `is south of` |
| Symbols | Letters, nonsense syllables, real words or emoji |
| Symbol pool | Fresh symbols per set, or one fixed set reused throughout — the hardest option, since nothing but recency tells sets apart |
| Clock   | A per-screen cap, reading time included |

## Run shape

A run of `R` sets takes `R + n` screens. The first `n` screens only load premises, and
the last `n` only ask questions, so every set is probed exactly once.

---

## Files

```
index.html              markup and script order
assets/css/style.css    all styling
assets/js/rrt.js        relation algebra + problem generation (pure, no DOM)
assets/js/fmt.js        statement → markup
assets/js/settings.js   setup model, presets, localStorage
assets/js/rail.js       the delay-rail SVG
assets/js/howitworks.js the explainer, rebuilt from current settings
assets/js/app.js        screens, run loop, results
tools/                  test harness (Node, no dependencies)
```

Settings and past runs live in `localStorage` on the device. Nothing is sent anywhere.

## Tests

```bash
node tools/verify.js   # builds an independent model of each problem and checks
                       # every displayed sentence and every stated answer
node tools/smoke.js    # runs the whole app in a tiny DOM shim: setup, a full
                       # run, the result sheet
```

`verify.js` currently checks 108,000 generated problems across all six relations and all
scrambling combinations.

---

## Credit

The relation set, the scrambling ideas and the phrasing conventions are adapted from
[Syllogimous v3](https://github.com/4skinSkywalker/Syllogimous-v3) by 4skinSkywalker,
which is released under CC BY-NC 3.0. The n-back delay mechanic, all of the code in this
repository and the interface are original work.

Not included from the original: syllogisms, analogies, binary/boolean questions and the
sorting test. They do not chain the same way, so they were left out rather than bolted on.

## License

CC BY-NC 4.0 — see [LICENSE](LICENSE).
