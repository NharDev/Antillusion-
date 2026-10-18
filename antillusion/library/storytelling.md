# Storytelling craft: plot, characters, dialogue, twists, scenes, screenplay format
tags: story plot twist screenplay script dialogue characters worldbuilding structure act hero journey novel short story fiction narrative arc conflict theme screenwriting fountain قصه قصة حبكه توست تويست سيناريو حوار شخصيات رواية حكايه عالم بنيه السرد صراع ذروه نهايه

## Pick the engine of the story
- **Character-driven**: protagonist's want vs need; the plot is the pressure that forces change.
- **Plot-driven**: a clear external goal + ticking clock; characters are revealed by choices under pressure.
- Always: *someone wants something badly, something stands in the way, and failing costs something real.*

## Structure (use the one the genre needs)
**Three acts / 8 beats** — 1 Hook & ordinary world · 2 Inciting incident (the call, can't go back) · 3 First-act break (commits to the journey) · 4 Fun & games / rising tests · 5 Midpoint reversal (false victory or false defeat; stakes rise) · 6 All is lost (loses what they thought they needed; the "dark night") · 7 Climax (acts on the *need*, not the want) · 8 Resolution (new normal; echo the opening image).
Short story (1500–4000 words): compress to hook → complication → turn → climax → resonant last line. One protagonist, 1–3 settings, one central question.
Other shapes: hero's journey (call, threshold, mentor, ordeal, return with elixir), Kishōtenketsu (introduce, develop, twist, reconcile — no conflict needed), in medias res + flashbacks, rashomon (same event, different truths), frame story, reverse chronology (Memento).

## Logline & premise
Logline: *When [inciting event], a [flawed protagonist] must [goal] before [stakes/clock], but [obstacle/irony].* Premise test: can you feel the ending's irony from the logline?

## Characters that live
Want (external) · Need (internal) · Flaw/lie they believe · Ghost (wound that created the lie) · Secret · Contradiction · Voice (sentence length, vocabulary, verbal tics, what they never say). Arc types: positive (lie → truth), negative (truth → lie, tragedy), flat (they hold truth and change the world). **The antagonist is the hero of their own story and is right about something.** Give every side character one desire that collides with the protagonist's.

## Scenes
Scene = goal → conflict → outcome (yes-but / no-and). If nothing changes, cut it. Enter late, leave early. End on a turn, a question or an image. Alternate intensity (quiet scene after a loud one). Every scene should do two jobs (plot + character/theme/world).

## Dialogue
- Subtext: people avoid saying what they mean; the line is the tip, the want is beneath it.
- Each speaker sounds different (rhythm, words, interruptions); read it aloud.
- Cut greetings, repetition, "as you know" exposition; reveal facts as weapons in conflict.
- Beats: action/gesture between lines instead of adverbs; silence is a line.
- Arabic: narration in clear Modern Standard Arabic; dialogue may use the dialect the character really speaks (Gulf, Levantine, Egyptian…) when the user wants realism — be consistent per character.

## Twists that work
A good twist is **surprising and inevitable**. Build it in four moves:
1. **Plant** the true fact early, camouflaged (hidden in a joke, in action, among several similar details).
2. **Misdirect**: give the audience a satisfying wrong explanation (the red herring must be plausible and emotionally invested).
3. **Reveal**: change what the audience believes about *who/what/why* with one clear image or line; no new facts at the reveal (no cheating).
4. **Re-read**: earlier scenes now mean something else — list 3 lines/details that gain a second meaning.
Types: identity (who), reality (what's real), motive (why), time, reliable-narrator break, reversal of roles (victim↔villain), "the answer was in the question". Avoid: "it was a dream", deus ex machina, twist that makes the story meaningless, twist unconnected to the theme.

## Theme
State the controlling idea as a claim ("Loyalty without truth becomes a cage"). The ending proves or refutes it; every subplot gives a variation.

## Worldbuilding (only what the story touches)
One big "what if", rules and costs (magic/tech always has a price), how daily life differs, one icon/object that stands for the world, history as a source of current conflict. Show through behaviour, not lectures.

## Genre contracts
Thriller: ticking clock + information control · Horror: dread > gore, rules broken · Sci-fi: idea as character · Fantasy: wonder + cost · Romance: obstacle that is internal + earned reunion · Mystery: fair-play clues · Comedy: rule of three + escalating commitment · Drama: honest choice between two goods/evils.

## Screenplay format
Fountain/plain format (works as `.fountain` or markdown):
```
INT. RADIO ROOM - NIGHT

A dead room lit only by the amber glow of a dial. MARA (30s, tired eyes) sits very still.

                    MARA
          Is somebody there?

The static breathes. Then a VOICE, warm and close.

                    VOICE (V.O.)
          I've been waiting for you.
CUT TO:
```
Rules: slug lines (INT./EXT. PLACE - TIME), action in present tense and visual only (what the camera sees/hears), one page ≈ one minute, character names in caps on first appearance, parentheticals rarely, transitions rarely.

## Interactive / branching narrative
Model as a graph: node = scene (text + choices), edge = choice with conditions/state (`flags`, `trust`, `items`). Keep 2–3 meaningful branches that reconverge ("bottleneck" scenes) so content stays manageable; consequences must be visible later; give the player a reason to replay. Data format: `{ id, text, speaker, choices:[{label, goto, set:{flag:true}, if:"flag"}] }`. Tools: ink/inkjs, Twine/Harlowe, or a tiny custom engine (see games/game-architecture for state machines).

## Process for long pieces
bible.md (premise, themes, characters, rules, timeline) → outline.md (beats/chapters) → draft scene by scene → continuity pass (names, ages, timeline, rules, planted clues) → polish pass (cut 10 %, sharpen first/last lines, vary rhythm) → deliver as files.
