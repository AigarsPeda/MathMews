# Math Mews puzzle expansion catalog

Research snapshot before implementation. The user subsequently chose to replace the old puzzles and start learning progress fresh. See [the implemented curriculum](puzzle-curriculum.md) for the current catalog, navigation, reset behavior and authoring instructions.

Proposed content, 19 October 2026. These are authoring specifications, not shipped puzzle JSON. They accompany the [research and progression proposal](puzzle-design-research.md).

The catalog contains 36 ordinary tasks, six bosses with three phases each, and 12 optional challenges. That is 54 activities containing 66 task specifications. Each ordinary task below includes its intended skill, answer and first mathematical hint. Production authoring still needs complete distractors, graduated help, explanations, shared data and equivalent English/Latvian wording.

Use difficulty → topic → lessons → puzzles for navigation. These tasks belong inside the relevant chosen topic, rather than one mixed path per difficulty. Bosses mark lesson-group or topic milestones; challenges branch from related lessons.

F1 to F6, C1 to C6 and R1 to R6 identify the initial lesson units described in the progression proposal. They are authoring references, not top-level topic names or a mandatory order through every subject. Group them under visible topics such as addition/subtraction, multiplication/division, fractions and patterns. Placement assumes the stated prerequisite skills, not a child's age. The later examples in a band should not appear as a random early task. Missions combining subjects should be labeled optional mixed-topic missions.

## Ordinary tasks

### Foundations

| ID and chapter | Family and child task | Answer | First hint and intended skill |
| --- | --- | --- | --- |
| F01 · F1 | Compare. Two equal-size trays show 6 and 9 toy mice. Which tray has more? | The tray with 9 | “Match one mouse from each tray. Which tray still has mice?” Compare quantities. |
| F02 · F1 | Order numbers. Put 8, 3, 6 and 1 from smallest to largest. | 1, 3, 6, 8 | “Find the smallest first.” Order whole numbers. |
| F03 · F2 | Story choice. There are 4 balls in a basket. The cat adds 2. How many now? | 6 | “Are balls joining the basket or leaving it?” Recognize addition. |
| F04 · F2 | Story choice. There are 9 cushions. Move 4 into another room. How many stay? | 5 | “Keep track of the cushions that stay.” Recognize subtraction. |
| F05 · F3 | Pair sum. Choose two different tiles from 2, 8, 3, 6 and 5 to make 10. | 2 and 8 | “Choose one number. What part of ten is missing?” Complements to ten. There is only one 5 tile. |
| F06 · F3 | Balance. A tray shows 7 + ? = 10. Fill the missing part. | 3 | “How far is seven from ten?” Missing addend. |
| F07 · F3 | Number line. Start at 6 and move 3 places forward on a line from 0 to 10. Where do you land? | 9 | “The starting point is six. Count the moves after it.” Relate addition to movement. |
| F08 · F5 | Pattern. The ribbon numbers are 1, 3, 5, 7. Each step adds the same amount. What comes next? | 9 | “Compare two neighboring numbers.” Repeated addition of two. |
| F09 · F5 | Function machine. 3 goes in and 8 comes out. Choose among +5, +4 and ×2. | +5 | “Test a rule on the input.” Select among explicit candidate rules. |
| F10 · F6 | Fair share. Share 12 whole toy fish equally among 3 bowls. How many per bowl? | 4 each, none left | “Give each bowl one fish, then repeat.” Exact sharing. |
| F11 · F6 | Fraction build. A mat has 4 equal parts. Color one quarter. | Shade 1 of 4 | “The four parts make one whole mat.” Unit fractions. |
| F12 · F3 | True or false. The cat says 4 + 5 = 10. Is the cat right? | False, the sum is 9 | “How many would five need to make ten?” Check a near-target claim. |

F07 depends on an explicit change to the current Hard-only number-line policy and its tests. F09 is a choice among visible rules, not a claim that one input/output pair uniquely determines a mathematical function. Grouping and sharing tasks require their earlier concrete lessons even if their numbers are small.

### Connections

| ID and chapter | Family and child task | Answer | First hint and intended skill |
| --- | --- | --- | --- |
| C01 · C1 | Story choice. The cat finds 46 paper stars, then makes 27 more. How many altogether? | 73 | “Can you make a new ten with the ones?” Addition across a ten. |
| C02 · C1 | Fix mistake. Minka writes 52 − 18 = 44. Repair the answer and choose the helpful step. | 34; 52 − 10 = 42, then 42 − 8 = 34 | “Split eighteen into ten and eight.” Regrouping through a subtraction strategy. |
| C03 · C3 | Fair share. Share 23 whole bells equally among 5 cats. How many each and how many left? | 4 each, 3 left | “How many groups of five can you use?” Quotient and remainder. |
| C04 · C2 | Function machine. 2 becomes 8 and 3 becomes 12. Choose ×4, +6 or ×3. What would 6 become? | ×4; 24 | “Your rule must work for both examples.” Verify and transfer a multiplicative rule. |
| C05 · C4 | Target build. Keep 5, 4 and 2 in this order. Insert operators to make 13, using multiplication before addition. | 5 + 4 × 2 = 13 | “Which neighboring numbers could make eight?” Precedence after explicit instruction. |
| C06 · C4 | Operation path. Start at 18, use 3 and then 4 as operands, and reach 10. Choose from +, −, × and ÷. | 18 ÷ 3 = 6, then 6 + 4 = 10 | “What could the number just before ten be?” Plan a short route. Other valid routes must also be accepted. |
| C07 · C2 | Compare. Which shelf holds more, 3 rows of 7 toys or 4 rows of 5 toys? | 3 × 7 = 21 is greater than 4 × 5 = 20 | “Find the total on each shelf.” Compare multiplicative quantities. |
| C08 · C5 | Equivalent fraction. A same-length ribbon has 2 of 3 equal sections colored. Which sixths show the same amount? | 4/6 | “Split every third into two equal pieces.” Equivalence with a common whole. |
| C09 · C5 | Fraction match. Match the symbols 2/5, 3/4 and 5/6 to three pictures with equal parts. | Respectively 2 of 5, 3 of 4 and 5 of 6 shaded | “Count the total equal parts first.” Connect visual and symbolic fractions. |
| C10 · C6 | Estimate. About how many stickers are 68 + 29? Choose about 50, 100 or 150. | About 100 | “Which nearby tens are easier to add?” Estimation before exact calculation. |
| C11 · C2 | Pattern. The machine doubles each number: 5, 10, 20, 40, ?. | 80 | “Apply the same change to forty.” Use a stated multiplicative rule. |
| C12 · C4 | Balance. Six identical boxes hold 42 bells altogether. Solve 6 × ? = 42. | 7 | “Which fact connects six and forty-two?” Inverse relation of multiplication and division. |

C04 needs a renderer/data extension for multiple input/output examples and a follow-up prediction. C02 needs separate answer and reason steps if both are assessed; the initial release can use the existing repair choice with its explanation. Do not give two learning credits for the same response.

### Reasoning

| ID and chapter | Family and child task | Answer | First hint and intended skill |
| --- | --- | --- | --- |
| R01 · R1 | Target build. Keep 9, 3 and 4 in order. Insert operators to make 21 under standard precedence. | 9 + 3 × 4 = 21 | “Which operation must happen first?” Apply precedence. |
| R02 · R1 | Operation path. Start with 48 and use operands 6, 5 and 2, in that order, to reach 26. Each arrow finishes before the next. | 48 ÷ 6 = 8; 8 + 5 = 13; 13 × 2 = 26 | “Work backward from twenty-six for one step.” Plan connected operations. |
| R03 · R3 | Compare. Which is greater, 3/4 of 32 or 2/3 of 33? | 24 is greater than 22 | “Find one equal part of each amount first.” Fractions of quantities. |
| R04 · R2 | Fraction build. Make 7/10 of one whole strip. | Shade 7 of 10 equal parts | “The denominator names the total equal parts.” Connect symbols to a whole. Use as review, not a hard-level milestone. |
| R05 · R2 | Fraction match. Match 3/8, 5/12 and 7/10 to their equal-part models. | 3 of 8, 5 of 12 and 7 of 10 shaded | “Check the whole before comparing shaded parts.” Review representation with varied partitions. |
| R06 · R3 | Story choice. There are 30 seedlings. Three fifths are flowers. How many are flowers? | 18 | “What is one fifth of thirty?” Fraction of a set. |
| R07 · R5 | Fix mistake. Minka says 25% of 60 is 12. Repair the calculation. | 15; one quarter of 60 is 15 | “What fraction is twenty-five percent?” Connect percent and fraction. |
| R08 · R4 | Rate story. Four cats use 120 grams of craft clay equally. At the same amount per cat, how much for seven cats? | 210 grams | “Find the amount for one cat.” Unit rate and scaling. |
| R09 · R6 | Estimate. Estimate 198 × 6 before calculating. Choose about 600, 1,200 or 12,000. | About 1,200 | “Replace 198 with a nearby friendly number.” Multiplicative magnitude. |
| R10 · R1 | Balance. A number divided by 7 gives 9. Find ? in ? ÷ 7 = 9. | 63 | “Which multiplication reverses this division?” Unknown starting quantity. |
| R11 · R6 | Pattern. The increases are +3, +6 and +9 in 1, 4, 10, 19. Continue increasing the jump by 3. What comes next? | 31 | “What will the next jump be?” Track a changing rule. |
| R12 · R3 | True or false. The cat says 2/3 + 1/3 = 3/6. Check with equal-length bars. | False; 3/3 = 1 | “The size of a third stays the same when you combine thirds.” Fraction addition and denominator meaning. |

R02 is a sequential path, unlike R01's written expression. The prompt, controls and feedback must preserve that distinction. R04 and R05 intentionally review earlier skills. Their larger denominators should not be mistaken for strong evidence of advanced reasoning.

## Boss missions

Each mission uses familiar controls, gives help on the active phase and saves completed phases. A mistake does not reset the mission. The child can leave, practise a prerequisite, or continue to the next chapter and return later. Award the chapter souvenir on completion regardless of hints used.

### B01 The cat picnic

Placement: F3. Prerequisites are joining quantities within 20, subtracting a small quantity and completing ten. No division is required, which makes this a suitable first pilot boss.

| Phase | Task and visible result | Answer | Support |
| --- | --- | --- | --- |
| Pack | There are 8 cups in one basket and 5 in another. How many cups altogether? Combining the baskets fills the packing tray. | 13 | Nudge toward making ten. A separate worked example uses 7 + 5. |
| Deliver | Move 3 of the 13 cups to another picnic. How many stay? The child sees the three cups move. | 10 | Keep the 13 visible; distinguish moved cups from remaining cups. |
| Finish | Four of the ten places have napkins. How many more napkins finish the picnic? | 6 | Show ten places with four occupied and leave the missing places for the child. |

Mission result: the cat and friends sit at the prepared picnic. Souvenir idea: a picnic pennant. Later transfer check: 9 + 4 in a different setting, without reusing the boss answer.

### B02 The toy shelf

Placement: F6. Prerequisites are small equal groups, exact sharing and halves of an even set, all taught with concrete objects before the boss.

| Phase | Task and visible result | Answer | Support |
| --- | --- | --- | --- |
| Stock | Three shelves each need 4 toy mice. How many mice fill the shelves? | 12 | Fill one row and repeat; connect the groups to 4 + 4 + 4. |
| Share | Pack those 12 mice equally into 3 boxes. How many in each box? | 4 | Deal one mouse into every box per round. |
| Display | Put half of all 12 mice on display. How many are on display? | 6 | Split the complete set into two equal groups. |

Mission result: the cat explores the stocked shelf. Souvenir idea: a small shelf badge. Transfer check: split a different even quantity into halves with a different arrangement.

### B03 The parcel station

Placement: C4. Prerequisites are multiplication, exact division and missing addends. Keep parcel quantities visible across phases.

| Phase | Task and visible result | Answer | Support |
| --- | --- | --- | --- |
| Count | Four boxes contain 6 parcels each. How many parcels arrive? | 24 | Represent four rows of six. |
| Sort | Divide the 24 parcels equally among 3 delivery carts. How many per cart? | 8 | Connect 3 × ? = 24 with sharing. |
| Collect | One cart has 8 parcels and can carry 15. How many more fit? | 7 | Show the occupied and available spaces separately. |

Mission result: the chosen cart delivers parcels into a room. Souvenir idea: a parcel stamp. Transfer check: a missing addend with a different capacity and no cart illustration.

### B04 The lantern workshop

Placement: C6. Prerequisites are addition within 100, rounding to the nearest ten and equivalent fractions. The phases share a workshop plan rather than requiring every answer to feed the next calculation.

| Phase | Task and visible result | Answer | Support |
| --- | --- | --- | --- |
| Prepare | Join 18 lanterns from one crate with 26 from another. How many are ready? | 44 | Separate tens and ones, then combine. |
| Estimate | Round the total of 44 to the nearest ten for the workshop's rough count. | 40 | Place 44 between 40 and 50. Label this an estimate, not an exact supply order. |
| Decorate | A ribbon has half its length colored. A matching ribbon is split into 6 equal parts. How many parts show the same amount? | 3 parts, or 3/6 | Align equal-length wholes, then compare halves and sixths. |

Mission result: lanterns light a completed workshop display. Souvenir idea: a paper lantern. Transfer check: represent 2/3 as sixths on a fresh ribbon.

### B05 The garden plan

Placement: R6. Prerequisites are rectangular arrays interpreted as area, fractions of a quantity, multiplication with money models and checking a budget. Teach the square-unit model in core tasks before using it here.

| Phase | Task and visible result | Answer | Support |
| --- | --- | --- | --- |
| Measure | A rectangular garden has 6 rows of 4 square planting spaces. How many square spaces are there? | 24 | Use a row-by-column model. Do not confuse the boundary length with the number of squares. |
| Plant | Three quarters of the 24 spaces need flowers. How many flower spaces? | 18 | Find one quarter, then take three groups of that size. |
| Budget | Each flower space needs one 3-coin seed packet. Find the cost for 18 packets and the change from 60 coins. | 54 coins; 6 coins change | Separate cost and change into two visible steps within this phase. |

Mission result: the garden grows into the child's selected color arrangement. Souvenir idea: a flower tile. Transfer check: a different fraction of a different set, followed later by a separate budget task.

### B06 The toy shop opening

Placement: R5. Prerequisites are multiplication, quarter discounts, repeated cost and subtraction. The shop uses fictional coins, with no connection to a real-money purchase prompt.

| Phase | Task and visible result | Answer | Support |
| --- | --- | --- | --- |
| Unpack | Five boxes hold 8 toys each. How many toys are available? | 40 toys | Model five equal groups. |
| Price | A toy's usual price is 40 coins. Reduce it by 25%. What is the sale price? | 30 coins | Find a quarter of 40, then remove it. Distinguish the discount amount from the final price. |
| Check | Buy 3 toys at 30 coins each using 100 coins. What is the total cost and change? | 90 coins; 10 coins change | Show the repeated cost before calculating change. |

Mission result: the cat opens the prepared shop. Souvenir idea: a shop sign. Transfer check: a 25% discount on a new amount, without repeating the 40-coin calculation.

## Optional challenges

These tasks test a new constraint or a second way to solve. All remain available later and allow help. Use a preview that explains what makes the challenge different. Some need multiple-solution tracking or visual construction beyond the current single-answer UI.

### Foundations challenges

| ID and prerequisites | Child task | Complete acceptance rule | Hint |
| --- | --- | --- | --- |
| FC1 · F3 complements to ten | Find every pair of different tiles making ten from 1, 2, 3, 7, 8 and 9. | Three unordered pairs: 1 + 9, 2 + 8, 3 + 7. Reversed pairs count once. | “Try the smallest tile that has no partner yet.” |
| FC2 · F3 number movement | Start at 2 and reach 10. Each move adds either 2 or 4. Find the fewest moves. | Two moves, +4 then +4. Also accept longer valid routes as partial progress, without calling them optimal. | “What is the biggest move you can use?” |
| FC3 · F3 addition within 20 | Use exactly three different tiles from 2, 3, 4 and 5 to make 12 by adding. | The set 3, 4, 5, in any order. | “What is the largest total three of these tiles can make?” |
| FC4 · F6 halves and equal parts | A mat has six equal square cells. Show half in two different patterns. | Any two different sets of three shaded cells. There are 20 possible sets; rotating an arrangement still produces a different cell set unless the design explicitly groups rotations. | “The amount must stay the same even when the positions change.” |

FC2 is conditional on the number-line policy decision. FC4 must state that half refers to area; the three colored cells need not touch. Give tap selection and a clear reset so drawing precision is irrelevant.

### Connections challenges

| ID and prerequisites | Child task | Complete acceptance rule | Hint |
| --- | --- | --- | --- |
| CC1 · C4 operation paths | Start at 6, then use operand 2 twice. Find every two-step route back to 6 using +, −, × or ÷. Keep intermediate values whole. | Four routes: + then −; − then +; × then ÷; ÷ then ×. | “Can the second step undo the first?” |
| CC2 · C3 quotient and remainder | Pack 17 whole toy mice equally into 4 boxes, putting as many as possible in each. Explain why one remains. | 4 per box, 1 left. Accept 4 × 4 + 1 = 17 or an equivalent complete distribution model. | “Would five in every box require more mice than you have?” |
| CC3 · C2 arrays | One shelf has 6 rows of 4 toys. Another has 4 rows of 6. Show why the totals match without counting each toy again. | Both totals are 24. Accept a rotated matching array or a valid row/column grouping explanation. | “What happens if you turn one array?” |
| CC4 · C4 multiplication and budgets | Bells cost 3 coins and ribbons cost 4. Spend exactly 30 coins, buying at least one of each. Find all combinations. | 6 bells and 3 ribbons; or 2 bells and 6 ribbons. Counts must be positive integers. | “Try ribbon counts that leave a multiple of three.” |

CC1 requires left-to-right path evaluation. CC4 needs a validator over counts, not a single saved answer string. A display of possible purchase counts can keep the task accessible without free typing.

### Reasoning challenges

| ID and prerequisites | Child task | Complete acceptance rule | Hint |
| --- | --- | --- | --- |
| RC1 · R1 precedence | Keep 6, 3 and 2 in order. Insert +, −, × or ÷, without brackets, to make 4. Find all solutions under standard precedence, with whole-number division. | 6 ÷ 3 + 2 = 4 and 6 ÷ 3 × 2 = 4. | “What can the first two numbers become?” |
| RC2 · R5 discounts | The same 80-coin item is offered with a 25% discount or a 20% discount. Which price is lower, and by how much? | 60 versus 64 coins. The 25% offer is 4 coins cheaper. | “Compare final prices, not just the discount labels.” |
| RC3 · R1 multiplication | The cat claims multiplication always makes 6 bigger. Test ×0, ×1 and ×2. Select every counterexample to “bigger”. | ×0 and ×1. Results are 0, 6 and 12; both smaller and equal disprove “always bigger”. | “Does staying equal count as getting bigger?” |
| RC4 · R4 scaling and discrete packs | A workshop needs 180 grams of clay. Sealed bags hold 50 grams each. What is the smallest number of bags to buy, and how much remains? | 4 bags; 20 grams left after use. Accept a model showing 3 bags are insufficient and 4 give 200 grams. | “A fraction of a sealed bag cannot be purchased.” |

For RC4, teach the distinction between a divisible quantity and an indivisible purchase before making it a challenge. It should test the consequence of a stated constraint, not surprise children with a hidden rule.

## Priorities for the first chapter

Use B01 as the initial complete boss. Author a ten-task F3 sequence that develops complements to ten and addition/subtraction within twenty, using F05, F06 and F12 where suitable and seven additional variants with a clear learning purpose. Offer FC1 and FC3 as its optional challenges. Teach F1 and F2 prerequisites or provide a ready route into them.

This pilot contains 15 task specifications: ten core tasks, three boss phases and two optional challenges. Do not ship the entire catalog as a flat mixed queue. Map every task to its prerequisite and provide the relevant introduction, worked example, feedback and later transfer check first.
