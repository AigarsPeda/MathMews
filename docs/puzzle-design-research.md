# Math Mews puzzle progression and hint design research

Implementation note, 19 October 2026: the later [three-life system](puzzle-curriculum.md#three-shared-lives) replaces the unlimited-retry behavior described in this historical review.

Research snapshot before implementation. The user subsequently chose to replace the old puzzles and start learning progress fresh. See [the implemented curriculum](puzzle-curriculum.md) for the current catalog, navigation, reset behavior and authoring instructions.

Reviewed 19 October 2026. Proposal for the children's game. The existing game plan names ages 7 to 12; the puzzle files span ages 6 to 12. Use demonstrated skills to place children, with age only as a starting guide. Adult mode is outside this proposal.

Organize the game as difficulty → topic → lessons → puzzles. Keep Easy, Medium and Hard, then let children choose what they want to learn, such as addition, fractions or patterns. Each topic has its own lesson sequence, progress, help, bosses and optional challenges. Keep the current puzzle interaction families as ways to practise those topics.

An initial content budget of 18 lesson chapters, 18 bosses and 36 optional challenges would provide 270 task specifications per language, compared with 123 today. Those chapters sit inside the chosen topics; they are not one mandatory path through every subject. Topic and lesson counts can grow independently. Suitable existing tasks become part of that curriculum. The companion [puzzle expansion catalog](puzzle-expansion-catalog.md) supplies 36 ordinary task examples, six complete boss designs and 12 challenges with answers.

## Recommended topic navigation

The first choice is Easy, Medium or Hard. The next screen shows topics with a clear description and progress for that difficulty. Choosing a topic opens its lessons. Choosing a lesson opens its puzzle levels. Returning players can continue their last lesson directly, while retaining access to topic selection.

For example: Easy → Addition → Making ten → puzzle levels → picnic boss → optional challenge. Medium → Addition opens more demanding addition lessons rather than a mixed queue of unrelated mathematics.

Use a shared subject catalog across difficulties, with different lesson content at each difficulty. The following is a starting structure to review against the actual content, not a requirement to launch every topic at once.

| Topic | Easy lesson examples | Medium lesson examples | Hard lesson examples |
| --- | --- | --- | --- |
| Numbers and comparison | Counting, ordering and tens/ones | Place value and comparing expressions | Decimal and fraction magnitude |
| Addition and subtraction | Within ten, making ten, within twenty | Regrouping and missing values | Multi-step problems and efficient strategies |
| Multiplication and division | Equal groups and concrete sharing | Arrays, facts, division and remainders | Connected operations and scaling |
| Fractions | Equal parts, halves and quarters | Magnitude and equivalence | Fraction operations and applications |
| Patterns and logic | Repeating patterns and constant jumps | Multiplicative rules and missing terms | Changing rules, constraints and explanations |
| Measurement and estimation | Comparing lengths and estimating quantities | Units, rounding and arrays as area | Area, rates and estimation in applications |

Addition and subtraction may become separate topic cards as their lesson libraries grow. New subjects, such as geometry, time, money or data, can be added without changing the navigation. Show a topic at a difficulty only when it has a useful, reviewed lesson sequence. Avoid empty topic cards and an overwhelming launch catalog.

### Choice and progress within topics

Children can choose among available topics without finishing every earlier subject. Within a topic, lessons introduce skills in a sensible order. If a child needs a prerequisite, recommend the relevant lesson and explain why; do not require completion of an unrelated topic. For example, fractions can recommend an equal-sharing lesson without sending the child through the whole multiplication catalog.

Save progress for each difficulty, topic and lesson. A child can be comfortable with Hard addition and still choose Easy fractions. Completing a lesson should not automatically move them to another subject. Offer the next lesson in that topic, optional practice, or a return to topic selection.

Bosses belong at the end of a lesson group or topic milestone. Challenges branch from the relevant lessons. Topic bosses use the skills taught in that topic; a mission combining several subjects should be clearly presented as an optional mixed-topic mission. Hints follow the selected skill and the child's current step.

The later chapter recommendations describe the learning experience inside a topic. They do not replace this topic-selection structure.

### Structure for future expansion

Keep difficulty, subject, lesson, puzzle interaction and level role separate. Addition is a subject; making ten is a lesson; pair sum is an interaction; boss is a level role. A topic should support several interactions, and an interaction should work across several topics.

Use stable topic and lesson IDs with ordered lesson manifests that reference stable puzzle IDs. Adding a topic should mean adding its definition, localized title, lessons, puzzles and prerequisite links. Save records should use those IDs so new lessons do not reset completed work. A puzzle can teach one main skill and revisit supporting skills without duplicating its completion or rewards.

## Current game audit

### Inventory and progression

Each language has 123 authored puzzles, with matching IDs and interaction types. There are 246 localized entries, not 246 distinct mathematical tasks. The three JSON files each contain 41 entries. Runtime distribution differs because `constants/puzzles.ts` moves all number-line tasks into Hard.

| Measure | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Authored entries per language | 41 | 41 | 41 |
| Runtime entries per language | 39 | 39 | 45 |
| Authored age range | 6 to 8 | 8 to 10 | 10 to 12 |
| Runtime number-line entries | 0 | 0 | 6 |

Across each language there are 21 multiple-choice tasks; nine each of patterns, function machines and number ordering; three fraction-equivalence tasks; and six each of the other 12 types. That is 17 interaction types but only two or three examples of most types in each authored tier.

The Easy path exposes 14 interaction types in its first 19 puzzles. It starts with subtraction, then a pattern, a language riddle and a function machine. This gives variety, but little opportunity to learn a concept or a control before another appears. There are no chapter goals, boss definitions, challenge modes or prerequisite skill records in the current puzzle model.

The `ageRange` field is authored metadata. A repository search found no runtime placement or task selection using it. Within a tier, progression follows array order. Children can switch tiers, but the game does not recommend a task based on demonstrated readiness.

Primary implementation references: [catalog assembly](../constants/puzzles.ts), [puzzle types](../types/puzzle.ts), [path](../app/puzzles.tsx), [play session](../app/play.tsx), and [original audience definition](../doc/GAME_PLAN.md).

### Findings that affect learning

| Finding | Evidence in the current content | Proposed change |
| --- | --- | --- |
| Difficulty sometimes falls between tiers | `medium-op-1` has three operator decisions. `hard-op-2` is one division, 36 ÷ 4. | Tag step count, operator knowledge and decision demands separately. Place both by prerequisites. |
| Some tiers repeat the same mathematics | `medium-share-1` and `hard-share-1` both share 10 among 3. Both second sharing tasks share 7 among 2. All three equivalence tasks ask for 1/2 = 2/4. | Keep repeats as deliberate review. Give harder lessons a new reasoning demand. |
| Early tasks assume too much | `easy-tgt-1` offers all four operators and mentions order of operations. `easy-feq-1` asks for equivalent fractions without an earlier sequence establishing equal parts and equivalence. | Restrict operator choices during introduction. Teach prerequisites before symbolic synthesis. |
| Language can dominate the mathematics | The third Easy task is “all but 9” with 17 sheep. Its hint states the answer. | Put wording riddles in an optional language-and-logic branch, with an illustrated explanation. |
| Some displays remove the intended challenge | `hard-cmp-1` shows “2³ = 8” and “4² = 16”. This assesses comparing displayed numbers more directly than evaluating powers. | Decide the intended skill. Hide evaluated results for an exponent task, or label it comparison practice. |
| Broad topic labels obscure prerequisites | Rate, percentage and fraction stories are labeled `logic`; multiplication/division error tasks are labeled `subtraction`. | Add specific skill IDs. Retain broad topics for navigation only. |
| The same help can be too generic | Target-building hints say “Think about order of operations”; ordering hints describe swapping controls. | Separate control instructions, mathematical hints and feedback on a particular error. |
| Completion overstates mastery | Any correct submitted answer completes the puzzle. Topic stats store correctness and the last ten outcomes, without hint depth or independent first attempts. | Preserve completion rewards, but record independent evidence separately. |
| More content can reduce displayed wisdom | `computePetWisdom` divides solved content by the current catalog total. Shipping puzzles can lower the percentage. | Make earned milestones permanent. Show new chapter progress separately from established skill evidence. |

The Hard-only number-line rule is intentional in both catalog assembly and `scripts/check-game-systems.mjs`. This proposal recommends eventually allowing simple number lines earlier because their representation can support beginners. That requires changing the rule and its tests together, preserving IDs and save migration. A number line with 0 to 10 is not inherently an advanced task.

### Help and feedback today

Preserve several good decisions. Worked visual help is free, every puzzle receives a help template, and the examples use their own quantities. Pair sums accept any mathematically valid pair, and operator puzzles check the result rather than requiring the authored operator sequence. Wrong answers do not deduct happiness or hunger, consume lives, or block retries in the current answer path. Legacy life constants and controls remain, but current practice works at zero lives.

After an incorrect submitted answer, the result sheet shows the puzzle's single `hint`. Correct answers show its `explanation`. Retrying reshuffles applicable choices and clears most task state. Picture help is available before submission and again after dismissing the result and retrying, rather than as a direct action on the incorrect-result sheet. Help use is not attached to the learning evidence.

Picture help is currently a worked demonstration, not a scored practice exercise. For example, `VisualPracticeBoard` renders the scene used by the explanation player. Its filename should not be interpreted as evidence of a separate practice-to-transfer loop.

Relevant code: [visual templates](../constants/visual-explanations.ts), [worked scenes](../constants/visual-practice.ts), [help sheet](../components/puzzle/VisualHelpSheet.tsx), [answer checking](../utils/puzzle-type.ts), [rewards and completion](../utils/game-operations.ts), [topic stats](../utils/topic-stats.ts), and [game constants](../constants/game.ts).

The existing game-systems check passed during this review, including all 246 localized entries, help coverage, accepted authored answers, replay rewards and zero-life practice. That establishes a useful functional baseline. It does not establish educational suitability, reading comprehension or enjoyment. The audit is based on source and content inspection, not observation of children or a fresh native UI review.

## What the evidence supports

The following findings inform the design. Chapter lengths, unlock rules and adaptation thresholds later in this proposal are product hypotheses to test with Math Mews players.

### Make the mathematical action part of the play

Habgood and Ainsworth compared versions of a mathematics game for children aged 7 to 11. One study involved 58 children under fixed play time; a second involved 16 children choosing freely. Integrating the mathematics into the game action produced stronger learning in the first study and much longer voluntary play in the second. The small free-choice study does not predict a retention multiplier for Math Mews. [Habgood and Ainsworth, 2011](https://shura.shu.ac.uk/3556/)

Application: let children arrange equal rows to fill a toy shelf, divide deliveries among cats, or repair a route with number jumps. Their mathematical choice should visibly change the mission. Keep the shop and room rewards, while giving individual puzzles a satisfying outcome of their own.

### Give children competence and meaningful choice

Self-determination research on games links motivation to feeling capable, acting by choice and feeling connected. The 2010 review also discusses learning the controls as a condition for accessing enjoyable play. It is a general game-motivation account, not a trial of this children's curriculum. [Przybylski, Rigby and Ryan, 2010](https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf)

Application: demonstrate unfamiliar controls on a simple example. Offer two ready missions, let children request more challenge, and let the cat respond to discoveries and strategies. A child who needs help should still feel like the person making the solution happen.

### Treat difficulty and interest as separate design problems

Large online experiments with a number-line game found that easier conditions often produced longer play, while an analyzed subset showed slower learning with easier targets. Attrition and the learning subset limit generalization. [Lomas and colleagues, 2013](https://pact.cs.cmu.edu/pubs/Lomas%2C%20Forlizzi%20%26%20Koedinger%202013.pdf)

A later set of experiments covering more than 20,000 play sessions found that self-selected moderate difficulty could be motivating, moderate novelty worked better than either extreme, and suspense could help. These findings support testing choice and controlled variation. They do not justify engineered near misses or random rewards. [Lomas and colleagues, 2017](https://repository.tudelft.nl/record/uuid:c8957097-737e-4587-9ec8-c42984c48957)

Application: use predictable controls with changing goals, story consequences and occasional constraints. Let a child opt into a harder branch. Evaluate delayed learning alongside voluntary return, rather than optimizing minutes played alone.

### Teach in a sequence and connect representations

The 2021 What Works Clearinghouse elementary mathematics intervention guide gives strong evidence ratings to systematic instruction, clear mathematical language, well-chosen representations, number lines and deliberate word-problem instruction. Its evidence concerns supported instruction for students with or at risk of mathematics difficulties, not a standalone mobile game. [IES mathematics intervention guide, 2021](https://ies.ed.gov/ncee/wwc/PracticeGuide/26)

Application: begin with visible quantities, connect them to a diagram and equation, then ask children to work independently. Keep the representation available as a thinking tool. Avoid introducing a new control, unfamiliar notation and a harder calculation in the same task.

### Revisit skills after a delay

The IES learning-and-study guide recommends spacing, alternating worked examples with independent problems, connecting concrete and abstract representations, and retrieval through quizzes. It assigns different evidence strengths to these recommendations. [IES learning and study guide, 2007](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)

Application: introduce a skill in a short focused run, then mix it with known skills. Return to it in later sessions using different quantities or a different representation. An immediate retry of the same answer should not count as independent retention evidence. Exact review intervals remain a scheduling hypothesis.

### Give fractions and reasoning their own development

The fractions guide emphasizes understanding fractions as numbers and explaining why procedures work. Its number-line recommendation helps move beyond counting shaded pieces. [IES fractions guide, 2010](https://ies.ed.gov/ncee/WWC/PracticeGuide/15/Published)

The problem-solving guide recommends visual representations, monitoring the solution process and exposure to multiple strategies, with strong or moderate evidence ratings for these recommendations. [IES problem-solving guide, 2012, revised 2018](https://ies.ed.gov/ncee/wwc/PracticeGuide/16)

Application: progress from equal sharing to unit fractions, magnitude, equivalence and applications. Include occasional “Which picture explains it?” or “Which step needs fixing?” tasks. Keep explanations selectable or visual before asking for typed reasoning.

### Help should teach a next action

Aleven and colleagues describe both avoiding needed help and requesting answers without processing the explanation. Their early Help Tutor pilot had four students and does not validate an exact hint policy for young children. [Aleven and colleagues, 2006](https://www.cs.cmu.edu/~aleven/Papers/2006/Aleven_ea_IJAIED2006.pdf)

Koedinger and Aleven's review frames the balance between giving assistance and allowing independent work as an unresolved instructional problem. [Koedinger and Aleven, 2007](https://pact.cs.cmu.edu/koedinger/pubs/paper%20%2314.pdf)

A more recent randomized study involved 288 fourth graders aged 10 to 11. Fraction-game conditions with corrective feedback or explanatory adaptive feedback both improved near-transfer knowledge. The reported results do not establish explanatory feedback as uniformly superior for learning. Motivation decreased in the corrective-feedback and control conditions, while anxiety decreased in the explanatory-feedback condition. Math self-concept was lower in both game conditions than in the control condition. These mixed outcomes make emotional experience and transfer important checks alongside accuracy. [Demedts and colleagues, 2024](https://www.sciencedirect.com/science/article/pii/S0959475224001038)

The EEF feedback guidance warns that feedback can help or harm depending on how it is used. Its updated metacognition guidance supports explicitly teaching and modeling learning strategies. These concern teaching contexts; applying them to game hints is a design inference. [EEF feedback guidance, 2021](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/feedback), [EEF metacognition guidance, 2025](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/metacognition)

Application: offer the smallest useful hint first, then let children request a demonstration or solve alongside the cat. Give them another action to try. Preserve free help and full completion credit when they finish with support.

### Keep promises about learning specific

The EEF's September 2026 Mathematical Reasoning evaluation involved 238 schools and 6,443 pupils. It found a modest positive overall mathematics effect, reported as an effect size of 0.09, with high evidence security. The programme combined structured lessons, teacher training, teaching-assistant support and computer games over 12 to 15 weeks. Its result cannot isolate the contribution of the games or predict the effect of a standalone app. [EEF Mathematical Reasoning evaluation, 2026](https://educationendowmentfoundation.org.uk/projects-and-evaluation/projects/mathematical-reasoning-2023-24-trial)

Application: treat a coherent curriculum and dependable support as part of the product. Test what children can solve after play before making learning claims about Math Mews. More content and more time in the game are insufficient evidence on their own.

## Proposed progression

### Replace age assumptions with prerequisite skills

Keep Easy, Medium and Hard as entry choices, with visible topic selection beneath each. Organize the lessons inside each topic by skill and prerequisites. Use friendly chapter names rather than publicly ranking children by age or ability.

| Band | Starting skills | Initial lesson units to group within the selected topics |
| --- | --- | --- |
| Foundations, broadly the current Easy audience | Count objects, compare small quantities, recognize numerals | Quantities and order; joining and separating within 10; making 10 and working within 20; tens and ones; equal groups and repeating patterns; equal sharing and halves/quarters |
| Connections, broadly the current Medium audience | Understand addition/subtraction within 20 and tens/ones | Addition/subtraction within 100; arrays and multiplication; division and remainders; missing values and operation routes; fraction magnitude and equivalence; estimating and choosing a strategy |
| Reasoning, broadly the current Hard audience | Use basic multiplication/division, interpret simple fractions | Connected operations and precedence; fractions as numbers; fraction operations and applications; rates and scaling; percentages and money models; mixed constraints and explanation |

These units are content examples for the topic structure above, not six mandatory steps through the entire difficulty. Some topics will need several units; others can launch later. This is a game curriculum, not a claim of alignment to a national school standard. Have a primary mathematics educator review both English and Latvian sequencing before production authoring. In particular, percentage, exponent and rate tasks need their own prerequisites rather than a generic Hard label.

After a child chooses a topic, optionally offer a small set of welcoming sample tasks, with an “I want something trickier” choice. Begin with roughly four to six placement probes for that topic and extend only when readiness is unclear. Recommend a starting lesson provisionally; update the recommendation through ordinary play. Do not require an age or use a brief placement sequence to claim a reliable mastery diagnosis.

### Chapter rhythm

Each chapter has ten core task nodes, a boss and two optional challenge nodes. Eight core tasks introduce, build and vary the chapter skill; two revisit prerequisite skills. A returning player can receive different quantities on a review node. A chapter can span several sessions.

| Part | Child experience | Learning purpose |
| --- | --- | --- |
| Welcome and first task | A concrete mission and a familiar control | Establish the goal and provide an early success |
| Focused practice | Several related tasks with one changing feature | Build a strategy without constant interface changes |
| Variation and choice | Different representation or a choice of two ready tasks | Connect the skill and allow agency |
| Review | A task from earlier learning | Check recall and repair a prerequisite if needed |
| Boss | Three connected tasks using taught skills | Apply and combine skills in a memorable mission |
| Closing | Show what changed; offer the room, a break or another task | Give a satisfying stopping point |

Offer an initial session goal of three to five tasks, adjustable by the child and parent. This is a pacing hypothesis, not a researched ideal session duration. Preserve progress after every completed task and boss phase. Returning should resume the mission without replaying an introduction.

Bosses are recommended chapter finales, not mandatory skill gates. Once the core chapter is complete, the next chapter remains available even if the boss is postponed. A child who needs more preparation can choose a related practice task without losing chapter progress.

### Increase one demand at a time

| Dimension | Earlier task | Later task |
| --- | --- | --- |
| Number structure | Small quantities within one ten | Cross a ten, regroup, then use larger quantities |
| Representation | Objects and equation together | Choose a model, then solve with fewer prompts |
| Unknown position | 6 + 3 = ? | 6 + ? = 9, then ? + 3 = 9 |
| Decisions | One known operation | Choose an operation, then plan connected steps |
| Constraints | Find a valid answer | Satisfy an extra condition or find another solution |
| Reasoning | Select the answer | Match the reason, diagnose an error or test a claim |
| Transfer | Same structure with new quantities | Recognize the structure in a new context |

Do not make larger text loads, tiny targets, extra dragging or shorter deadlines part of the normal mathematical difficulty curve. Optional fluency practice can explore timing separately after accuracy is comfortable. No main-path boss needs a countdown.

Example addition ladder: combine 4 and 3 objects; connect the picture to 4 + 3; find the missing part of 7; make 10 from 7 and 3; use 8 + 5 with a make-10 model; choose why 8 + 5 equals 13; apply it to a delivery task. Larger numbers arrive after the strategy has meaning.

### Adaptation that remains understandable

Start with a small rule-based recommender within the selected topic. Maintain evidence per skill, not one global difficulty score. Cross-topic practice should be an explicit recommendation or a separately chosen mixed-practice mode. The following thresholds are initial test settings:

- Offer one step more challenge after at least four independent first-attempt successes among the last five distinct tasks at that skill and demand level. Include more than one representation before making a broad readiness claim.
- After two unsuccessful submitted attempts on the same task, offer a hint, a worked example or a related simpler task. Do not automatically demote the child.
- A task solved after a worked example contributes to completion and supported practice. Confirm independent readiness with a different task later.
- Revisit a skill in a later session, then after roughly three and seven days when the child returns. Missed review dates create no debt or penalty. Tune spacing after observing retention.
- In a five-task recommendation set, begin by testing three current-skill tasks, one earlier-skill review and one chosen application. If a prerequisite is weak, replace one current task with supported prerequisite practice.

These rules manage recommendations, not access to familiar replay or free help. Difficulty recommendations should change between tasks, with a short explanation such as “Let's try the same idea with a picture.” Time alone must not trigger a downgrade. Slow reading, reflection, accessibility needs and backgrounding all affect duration.

## Boss and challenge design

### Bosses should resolve a mission

A boss is a connected problem with visible progress. It combines skills the child has already met. It can feel bigger through its setting, phases and result without requiring giant numbers or an enemy to defeat.

Use a three-stage mission such as preparing a cat picnic: pack the food, divide the places, then check that everything is ready. Reuse existing task renderers in the first release. Completed phases stay complete. Allow unlimited retries, free hints, pause/resume and a direct practice detour. Retrying a phase never resets earlier phases.

Every boss needs an authored prerequisite list, three solvable phases, explanations, a related worked example, a support route and an outcome the child can see. Introduce its controls during ordinary tasks. If the final phase asks for a reason, that reasoning interaction must also have appeared earlier.

Award the ordinary phase rewards and a modest one-time chapter souvenir. Keep hint-assisted completion eligible for the same souvenir. Record help privately for recommendations. Do not build a star system in which requesting help permanently loses the best reward.

Six detailed missions appear in the companion catalog: the picnic, toy shelf, parcel station, lantern workshop, garden plan and toy-shop opening. Each includes all three answers and suggested support.

### Challenges should invite exploration

Challenges branch from the path and never block chapters, essential care or access to help. They increase depth by changing a condition: find a second solution, use fewer moves, spot a counterexample, repair one step or explain why an answer cannot work.

Keep challenge tasks replayable and available later. Give a small souvenir or ordinary reward without making them the best compulsory route to coins. A challenge requiring unfamiliar mathematics belongs in a taught chapter first. A challenge requiring a new control needs a demonstration.

For older children, a budget or “fewest steps” task can be compelling. For younger children, “Can you make ten a different way?” offers the same sense of discovery with familiar objects. State whether any solution works or a unique solution is expected. The validator must agree.

## Proposed hint system

### Separate instructions from mathematical help

“Tap two tiles to swap them” is an instruction. It should remain available without counting as mathematical assistance. “Compare the tens digits first” is a mathematical hint. Track these separately so unfamiliar controls do not lower a child's estimated skill.

Use one visible Help action with clear choices inside. After an incorrect answer, include “Try again”, “Show a hint” and access to picture help directly in the result flow. Preserve the child's selections and completed work where possible, rather than making them reconstruct their plan.

### Graduated support

| Support | What it does | Example for 8 + 5 |
| --- | --- | --- |
| Nudge | Direct attention to a relevant feature | “How many more does 8 need to make 10?” |
| Strategy | Name a useful approach | “Split the 5 so you can make 10 first.” |
| Guided step | Show a partial model; leave a meaningful action | Show 8 counters and split 5 into 2 and 3. Ask the child to finish combining. |
| Worked example | Demonstrate the method with separate quantities | Model 7 + 5 as 7 + 3 + 2, then return to the original task. |
| Solve together | Explicitly opt into completing the current task with support | Walk through 8 + 2 + 3 = 13. Then offer a fresh transfer task. |

Children may request a worked example immediately. Do not require wrong guesses, waiting or tapping every hint first. The exact number of support levels should follow observed usefulness; short tasks may need fewer.

Keep the current independent-example guarantee for picture help. “Solve together” would be a separate, explicit action that may use the active quantities. Its use records supported completion rather than independent mastery. The existing test preventing picture help from reading active puzzle content should remain in place for that mode.

On a multi-step task, target the current step and retain correct earlier work. On a boss, attach help to the active phase. If the same generic example is not helping, offer a more concrete representation or prerequisite practice rather than replaying it indefinitely.

### Feedback on useful errors

| Task and response | Useful feedback | Follow-up evidence |
| --- | --- | --- |
| 14 − 6, child selects 9 | “Count six moves. The starting number is not a move.” Show one labeled starting point. | Another subtraction task with different numbers |
| 3 groups of 4, child selects 7 | “You added the number of groups and the size of a group. Let's count what is inside all three groups.” | Match an array to an equation |
| 1/3 compared with 1/4, child chooses 1/4 | “Use the same-size whole. Four equal pieces make each piece smaller.” | Compare 1/2 and 1/3 with equal-length bars |
| 3 + 2 × 5, child selects 25 | “In this expression, multiply 2 and 5 before adding 3.” | A new expression with the same precedence demand |

An answer may have several causes. Store a proposed error category only where the response supports it; do not label a child as having a misconception from one choice. Ask for a model or another attempt if the cause is unclear.

Use specific success feedback occasionally: “You made ten first” or “Both pairs reach the target.” Keep celebrations brief, skippable and compatible with Reduce Motion. Avoid praise that labels the child as smart or slow.

## More content without repetitive tasks

### Expand depth before adding many controls

Keep all 17 families, but give them different roles. Multiple choice can check interpretation; construction shows a strategy; comparison develops magnitude; error repair and explanation check reasoning. No chapter needs all 17.

| Existing family | Productive progression |
| --- | --- |
| Multiple choice | Short concrete story, unknown in a different position, then a choice of model or explanation |
| Compare | Quantities, unevaluated expressions, fraction magnitude and estimates |
| Operation path | One choice with restricted operators, two connected choices, then a constraint |
| Target build | Add/subtract with fixed number order, explicit precedence, then another valid solution |
| Fraction build | Unit fractions, non-unit fractions, then equivalence using the same whole |
| True/false | Check a claim, then identify a reason or a counterexample |
| Balance | Missing part, unknown in another position, multiplicative relation |
| Number line | Small whole-number moves, crossing ten, magnitude and later fraction placement |
| Pair sum | Complete a target, find another pair, then list all valid pairs |
| Fix mistake | One visible incorrect step, identify why, then repair a longer solution |
| Estimate | Friendly whole numbers, magnitude, then choose a method before checking exactly |
| Fair share | Exact sharing, remainders, then distinguish whole-item and divisible-item contexts |
| Fraction equivalent | Match equal bars, build another form, then explain scaling |
| Pattern next | Constant changes, missing interior term, then a named or constrained two-step rule |
| Function machine | Select a rule, verify against several input/output pairs, then predict a new output |
| Order numbers | Whole numbers, place-value contrasts, then supported fraction/decimal order |
| Fraction match | Match symbols to equal parts, vary orientation, then connect area and number-line models |

Several later forms need small renderer or schema extensions. Begin by authoring better tasks with the existing components. Prioritize multiple examples for function machines, a missing-value model and visual reasoning choices before adding unrelated minigames.

For sequences, a finite list admits many mathematical continuations. Teach and state the intended rule family, or ask children to choose a rule consistent with all examples. Do not imply that an arbitrary short sequence has only one imaginable continuation.

### Content budget

| Scope | Core tasks | Bosses | Boss phase tasks | Optional challenges | Total task specifications |
| --- | --- | --- | --- | --- | --- |
| One chapter | 10 | 1 | 3 | 2 | 15 |
| One band of six chapters | 60 | 6 | 18 | 12 | 90 |
| Initial budget across three difficulties | 180 | 18 | 54 | 36 | 270 |

This budget has 234 path nodes distributed across topic lessons because each boss occupies one node but contains three tasks. It does not cap the number of topics or lessons. Each language needs the same 270 mathematical task specifications localized, giving 540 localized task entries if stored independently. Worked examples, tutorials and generated variants are additional content, not included in those totals.

Map suitable existing tasks into this structure before deciding the exact new-content count. If every current task were reused, the numerical increase would be 147 task specifications per language. Revision, reassignment to review and removal of unintended duplicates will change that production count.

Create three to five constrained variants for ordinary practice templates where useful. Changing a character name or choice order does not create independent learning evidence. A good variant changes quantities while preserving the intended strategy, or changes representation when transfer is the purpose. Track the template and variant so the recommender can avoid immediate repeats.

Generators must enforce mathematical and pedagogical constraints. For example, a “crossing ten” task must cross ten; a whole-number division task must divide exactly unless remainders are intended. Enumerate valid operator solutions, reject duplicate answer choices and check distractors after localization. Keep a small authored fallback pool if generation cannot find an acceptable item.

### Authoring record and quality checks

Add stable topic and lesson IDs, skill IDs and prerequisites, chapter placement, task role, demand level, representation, reading demand, numeric constraints, accepted answers, plausible errors, hint steps, worked-example reference and content version. A boss also needs phase IDs, completion state and a resume point. Separate localized wording from shared mathematical data where practical.

For every release candidate:

- Check mathematical correctness independently of the authored answer field. Enumerate possible answers where the response space is finite.
- Verify all legitimate solutions are accepted. Use the current pair-sum and operator validators as the starting principle.
- Review distractors for plausible errors rather than obviously unrelated numbers. Binary choices need later independent confirmation because guessing is easy.
- Review English and Latvian for equivalent meaning, reading demand and mathematical notation. Use fictional coins for economy tasks; intentionally localize any real units or money.
- Ensure same-size wholes in fraction comparisons, understandable scales and distinguishable shaded parts without color alone.
- Inspect small-screen, large-text, screen-reader, tap-alternative and Reduce Motion behavior in the native app. Do not score dragging skill as mathematics.
- Run existing game-systems checks plus new content validations. A separate educator review and child observation still determine suitability.

## Sustaining interest over time

Use the existing room and cat as a source of meaningful missions. A completed array stocks a shelf; a fair-sharing answer finishes a picnic; a route carries a parcel to a chosen room. Cosmetic themes can change while the mathematical action and controls remain familiar.

Offer a small choice of ready missions. Reveal a new story outcome or constraint after familiar practice, rather than changing the entire interface every task. Let children revisit favorites and construct a second solution. Periodic “help the cat find the mistake” tasks let the child take the knowledgeable role.

Keep earned souvenirs visible and permanent. A chapter ending should show the skill used and the mission result, with an equally clear way to return to the room or stop. New puzzle releases should add places to explore without erasing the meaning of previous achievements.

Keep free care and the current absence of wrong-answer penalties. The older game plan proposes sadness and hunger as pressure to return; that is not the learning loop recommended here. The companion should welcome return and help through mistakes. Do not connect puzzle failure, missed review dates or challenge refusal to pet distress, paid retries or lost streak protection.

## Validation and implementation order

### First build a complete small chapter

Pilot Foundations chapter 3, making ten and working within twenty, after checking its prerequisites. Build ten core tasks, one three-phase picnic boss and two optional challenges. Include a demonstrated interaction, graduated hints, solve-together, a fresh transfer task and a later-session review. This tests the complete experience with 15 task specifications before multiplying content.

Use approximately six to eight child-parent pairs for an initial formative round, spanning confident learners and children who need support. Observe English and Latvian use, including a younger reader and a child using larger text or tap alternatives. This sample finds problems; it cannot establish a retention or learning effect. Then test one chapter in each other band before authoring all 18.

Ask children to show how they understood the task, get help, resume a boss and choose what to do next. Record where an adult must intervene. Ask whether the challenge felt interesting, confusing or repetitive using simple choices. Avoid coaching them toward the correct control or answer during an observation task.

### Measure learning and interest separately

| Question | Measure | Interpretation |
| --- | --- | --- |
| Did the child learn the skill? | Independent first attempts on unseen equivalent tasks, including a later-session check | Immediate supported completion is insufficient |
| Did help help? | Next action after help, success on a fresh task, later hint depth | Lower hint use alone could mean children stopped asking |
| Is the progression suitable? | Errors and help by skill, representation and reading demand | An aggregate accuracy score can hide a bad chapter |
| Does the boss work? | Phase retries, exits, successful resumes, completed missions and child explanation | Long boss duration can mean confusion |
| Do children choose to return? | Return on a later day, chosen next mission and parent/child feedback | Measure voluntary interest alongside learning |
| Is the experience equitable? | Results by language and access needs where sample sizes permit | Do not pool away a language-specific problem |

Record first-attempt correctness, attempts, hint depth, worked-example use, solve-together use, active task time, task/template/version, skill, phase and exit/resume outcome. Exclude background and help-viewing time from solving-time comparisons. Keep event storage minimal and fit it to the app's child-data policy before deployment; no free-text child transcripts are needed for these metrics.

After usability problems are resolved, compare chapter sequencing with the current ordering using matched content, exposure opportunities and rewards. Test hint design separately, keeping help free in both conditions. Randomize by player or family, use unseen delayed checks, and report dropouts and uncertainty. Set the sample size and decision criteria from baseline data and a meaningful effect before running an efficacy test. Do not call a tiny pilot an A/B test proving learning gains.

### Delivery stages

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Topic structure and content map | Difficulty/topic selection, topic and lesson definitions, skill prerequisites, reassignment of all 123 current tasks, educator and localization review | Children can choose a topic; every core task has an intended skill and defensible lesson placement |
| 2. Pilot chapter | Fifteen tasks, boss resume, hint flow and separate learning evidence | Children can use the flow without repeated adult explanation; observed blockers are fixed |
| 3. Coverage across bands | One complete chapter per band and baseline observations | Challenge and language demands are workable across the audience |
| 4. Curriculum expansion | All 18 chapters, 18 bosses, 36 challenges and constrained practice variants | Mathematical, localization, save-migration and native accessibility checks pass |
| 5. Calibration | Revised item demands and recommendation rules using observed results | Interest and independent learning improve together within defined uncertainty |

Preserve stable puzzle IDs and completed records. Introduce topic and lesson manifests referencing those IDs rather than treating array position as identity. Save progress independently for each difficulty/topic/lesson combination. Keep legacy count migration intact and store boss phase completion separately. Persist hint evidence and the initial exposure outcome so closing and reopening a puzzle does not turn supported work into an independent first attempt.

New chapter or boss bonuses also need server reward support. The existing wallet queues puzzle rewards using puzzle IDs and attempt IDs. Do not implement compound rewards only on the phone. Specify one-time boss rewards, ordinary phase rewards and replay behavior, with idempotent recovery after interruption and cloud merge.

The first implementation should cover one whole chapter and its help loop. That gives children something complete to experience and provides evidence for the larger content investment.
