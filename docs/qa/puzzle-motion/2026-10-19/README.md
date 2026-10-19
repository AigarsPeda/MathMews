# Puzzle motion — 19 October 2026

The clips are crops of iOS Simulator recordings of the native QA screen, using the production puzzle components.

- [Tile settling](tile-settling.gif): the dragged number lands from its release point while neighbouring numbers slide into their new slots. Tap swaps use the same layout transition.
- [Progress fill](progress-fill.gif): completed segments fill from the left edge.

Landing takes 240 ms; cancelled or outside drops return in 200 ms; progress fills in 420 ms. All transitions respect the system Reduce Motion preference. Previously completed progress starts filled.

Validation: native ordering in both directions, repeated moves, outside drops, scrolling, solved-board locking, tap swaps, sorting transfers, pattern swaps and progress updates; TypeScript, targeted ESLint and the drag, puzzle-experience and progress checks.
