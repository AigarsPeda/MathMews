# Math Mews

Math Mews is an educational math puzzle game with a virtual cat companion, built with React Native and Expo. Supported game targets are iOS and Android.

The home screen shows the cat's current room, care stats, companion actions, store access, and the primary **Solve a Puzzle** action. Solving puzzles earns game coins. The store supplies cat coats, room styles, beds, furniture, and toys. Care and play retain their existing eligibility, completion, and reward rules.

The cat travels between the living room, bedroom, bathroom, and kitchen. Each room keeps its own saved layout. The editor supports placing, dragging, resizing, orienting, ordering, and removing objects, with doors assigned to destinations. Placed sofas and toys expose suitable rest or play actions.

## Current migration contract

Replace the cat world's sprite rendering with a native 3D engine while preserving all existing catalog IDs, saved placements, room assignments, menus, care, play, and math-game behavior. Keep the existing pastel room identity and controls. The cat keeps a constant apparent size, walks faster with distance-matched paw movement, and reacts to objects rather than crossing solid furniture. Doors stay correctly aligned and stationary. Use Filament and accessible rigid-body physics on both native platforms. Full-body ragdoll simulation is not a requirement for the normal walk.

This is an engine migration within the existing product; it does not authorize a visual redesign. Static control artwork, store thumbnails, and OS launch branding remain appropriate UI assets. Further changes follow once the migrated behavior is working.
