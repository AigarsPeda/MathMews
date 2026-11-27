# Math Mews: learning and text guide

This guide covers the words and the order of the puzzles. For pictures and motion, see PUZZLE_STYLE_GUIDE.md.

Goal: a child, a teenager or an adult can learn maths by playing. Learning happens gradually and smoothly from easy to hard, with repetition throughout. Every puzzle text should sound as if a kind, clear person wrote it, in English, Latvian and Russian.

## 1. Owner rules
| Rule | What it means |
|---|---|
| **Understanding first** | A puzzle is good when the player understands what to do and learns something. Variety comes second. |
| **Repetition is fine** | Repeating a technique or a question pattern is not a flaw. A lesson can ask the same kind of question many times if the steps grow gently. |
| **Gradual and smooth** | Each puzzle is the same or a little harder than the one before. Change one thing at a time. Older skills come back later as review. |
| **Hints teach a technique** | A hint explains, in general terms, how to solve this kind of problem. It can be the same for every puzzle of that kind. It never gives the answer or the answer's number. |
| **Natural text** | Short, plain and warm. No AI overtones (§7). |
| **Three native languages** | Latvian and Russian are written to sound native, not translated word for word. |
| **Change what helps learning** | Wording, numbers, order and even whole puzzles may change when that makes learning smoother (owner, 2026-11-28). Keep puzzle and lesson ids where you can, because saves point at them. When an id, order or skill must change, update the hash in scripts/puzzles/check-progression.mjs on purpose and say so in the report. |

## 2. Who is playing
Player profiles:
- **Easy:** about ages 6–8, or anyone starting out. Reads slowly and may be read to. Counts with objects.
- **Medium:** about ages 8–11. Reads well and is ready for symbols and two-step stories.
- **Hard:** ages 11 and up, including teenagers and adults. Wants to be treated as capable.

Voice by level (owner: playful at easy, plainer at hard):
- **Easy:** playful, warm and concrete. Talk about the cat, its toys, food and the home. Questions of up to 12 words where possible.
- **Medium:** friendly and direct. Everyday stories about shopping, time and sharing.
- **Hard:** plain and respectful, with no baby talk and no cuteness. Clear statements of the task, as in a good textbook.

Who appears in the stories (owner: both the cat and a few friends):
- **The cat:** the player's own pet, always called "the cat" (kaķis / кот). It has toys, mice, ribbons, bowls, a bed and a room.
- **Minka:** a friend who tries sums and sometimes makes a mistake for the player to fix. She already appears in fix-the-mistake puzzles.
- **Anna and Max:** two children who shop, cook, travel and share. Their names work in all three languages: Anna / Anna / Анна and Max / Makss / Макс.
- Use at most two characters in one puzzle. A person's name replaces an abstract label only when the picture shows that person's things.

## 3. Learning path (the order of puzzles)
A lesson path has 8 puzzles: practice, then a challenge, then more practice or a 3-puzzle boss.
1. **One idea per lesson.** The title names it: "Add by joining groups", "Find the missing part".
2. **Ramp:**
   - start with the easiest case, which is small numbers, objects and one step;
   - grow one thing at a time: bigger numbers, then fewer pictures, then symbols, then two steps;
   - never raise two things at once.
3. **Model, then picture, then symbol.** An idea first appears with objects or a model, and later in numbers only (`learning.representation`).
4. **Repeat to learn.** The same technique appears 3–5 times in a path with gently changing numbers, so the player feels it working.
5. **Review.** Later lessons and bosses mix in one or two earlier skills (`prerequisiteSkillIds`).
6. **The challenge stretches.** It is a little harder than the practice before it, never a different topic.
7. **Easy wins come first.** The first puzzle of a lesson should be solvable by almost everyone.
8. **No sudden jumps between lessons.** A lesson's first puzzle is close to the previous lesson's last.

## 4. The three texts of a puzzle
### Question
- Say what is happening, then ask one question. The question comes last.
- Use real things, not interface words.
  - Avoid "the shown time", "the marked square", "group A" and "the offered rule".
  - Say "the clock", "the blue square", "Mia's toys", "these rules".
  - Labels like A and B are fine when the picture shows them.
- One sentence for each fact. No nested clauses.
- Use the same verb for the same action everywhere: add, take away, share, compare, round.
- Numbers as digits. Units always written: 5 minutes, €3, 200 ml.

### Hint (a general technique)
- Explain how this kind of problem is solved, as a short method or a tiny example with other numbers.
  - "To find how many in all, put the groups together and count on from the bigger one."
  - "Sharing equally: give one to each plate, again and again, until none are left."
- One to three short sentences, the first step first.
- The same hint may serve every puzzle of a kind. That is good: the player learns the method.
- Never the answer, never the puzzle's own result, and never a "tip" that only works for this one puzzle's numbers.
- The picture help ("?") shows the same technique as an animated example. The hint should match it in words.

### Explanation (after answering)
- Give the reason in one sentence with the puzzle's own numbers, then the equation.
  - "You had 4 and got 3 more, so count on 5, 6, 7. 4 + 3 = 7."
- If the answer was wrong, the explanation still teaches. It never scolds.

### Lesson titles and descriptions
- A title names the skill in plain words, in up to 5 words.
- A description says what the player will do in one sentence, specific to the lesson. Never a description shared by every lesson ("Start with a model, then try the idea in different ways.").

## 5. Latvian
- Use the familiar "tu" forms throughout: Izvēlies, Saskaiti, Atrodi.
- Number agreement: 1, 21, 31… (but not 11) take the singular ("21 bumbiņa"). Other numbers take the plural ("5 bumbiņas").
- Use a decimal comma: 2,5.
- Write it as a Latvian would say it; don't mirror English word order.
- Use correct case after prepositions and numbers.

## 6. Russian
- Use the familiar **ты** throughout: Выбери, Найди, Посчитай. Never Выберите or Найдите.
- **Number agreement is required.** "1 ход, 2 хода, 5 ходов" and "21 ход, 22 хода, 25 ходов". A Russian string never puts a fixed noun ending after a number slot. It uses the plural form tool in scripts/puzzles/russian-content.mjs.
- Use the right words:
  - **число** means a number and **цифра** means a digit;
  - **сложи** means add and **вычти** means subtract;
  - **поровну** means equally.
- Use a decimal comma: 2,5.
- Watch for false friends from machine translation, such as "Присоединяйтесь к группам" for "Join groups". Rewrite these as a native speaker would: "Сложи две группы".

## 7. No AI overtones
Avoid:
| Avoid | Why | Instead |
|---|---|---|
| "Let's…", "Let us…" | Fake togetherness | Say the action: "Add the two groups." |
| "Great job!", "Awesome!", "Well done!" in puzzle text | Empty praise. The game gives feedback itself | Nothing, or the reason it worked |
| "Remember,", "Note that", "Keep in mind" | Lecturing | Just state the fact |
| "simply", "just", "easily", "carefully", "basically" | Filler. "Simply" makes a stuck child feel worse | Delete it |
| "Consider…", "Think about…", "Explore…" | Vague | Name the first step |
| Lists of three for rhythm ("count, check and compare") | AI cadence | One action |
| Em dashes and semicolons in child text | Bookish | Two short sentences |
| "In this puzzle, you will…" | Meta talk | Ask the question |
| "the shown", "the given", "the marked", "the offered" | Interface talk | Name the thing |
| Exclamation marks in questions | Shouting | A full stop |

Read the question aloud. If it sounds like a form, a manual or a chatbot, rewrite it.

## 8. Before and after
| Before | After |
|---|---|
| Make a forward jump. | Hop 2 forward from 4. Where do you land? |
| Start at the shown time. The activity lasts 25 minutes. When does it finish? | Football starts at 3:10. It lasts 25 minutes. When does it end? |
| Choose the rule that works for this machine. | 4 goes in and 12 comes out. What does the machine do? |
| Присоединяйтесь к небольшим группам | Сложи две группы |
| Небольшие цифры по порядку | Небольшие числа по порядку |
| Доберись … ровно за 3 ходов | Доберись … ровно за 3 хода |
| Hint: "Test each offered rule on the input." | Hint: "Try each rule on the number that goes in. The right rule gives the number that comes out." |

## 9. Grading (each lens 0–100, target 96)
| Lens | 96 means |
|---|---|
| **Learning path** | Every step in the lesson is the same or a little harder; one thing changes at a time; the technique repeats; earlier skills come back; no jumps between lessons |
| **Clarity** | A player at this level understands the question on the first read without the hint; the hint teaches the method without the answer |
| **Language** | English, Latvian and Russian each read as native and natural; correct grammar and number agreement; familiar "you" in Latvian and Russian; no AI overtones |
| **Interest** | Real, varied little stories where they help; a challenge that feels like a small win; nothing that feels like a form |
| **Correctness** | Pass or fail: one right answer, units, terms, no answer leaked in a hint (scripts) |

Visual is graded with PUZZLE_STYLE_GUIDE.md and is already 96 for every family.

## 10. How to change content
- Change the generators in scripts/puzzles/*.mjs. Never edit assets/puzzles/*.json by hand.
- Russian comes from locales/puzzle-text/ru.json through scripts/puzzles/russian-content.mjs. A changed English string needs its Russian entry.
- Rebuild with `npm run puzzles:build`. Then run `npm run test:puzzles`, `npm run test:game` and `node scripts/puzzles/check-puzzle-text.mjs`.
- Keep ids, order, skills and answers unless the owner approved a change.

## 11. Review checklist
Every puzzle in a lesson should pass these:
- [ ] The first puzzle is an easy win, and every next one is the same or a little harder.
- [ ] One thing changes at a time, and the technique repeats.
- [ ] The question says what happens and then asks one thing, with no interface words.
- [ ] The hint is a general method, with no answer and no answer number.
- [ ] The explanation gives the reason, then the equation.
- [ ] Latvian and Russian read as native: tu and ты, number agreement, decimal comma.
- [ ] Nothing from §7.
- [ ] The title and description are specific to the lesson.
