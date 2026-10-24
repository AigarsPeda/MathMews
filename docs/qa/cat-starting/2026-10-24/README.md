# Standing to walking, 24 October 2026

Historical QA notes. Demonstration images and recordings were deleted at the user’s request; referenced media below is no longer retained.

Ordinary floor walks now capture the standing paw contacts and release each paw into its first swing. A small support-height adjustment keeps those targets reachable and follows the lifting paws through recovery. The outgoing idle clip blends into walking over 0.22 seconds with eased endpoints. Head and tail follow-through builds during the first supported stride instead of waiting until the first-step IK finishes.

The new contact capture applies to ordinary floor routes starting at near-zero speed. Moving route changes, doorway entries and scripted multi-leg sequences retain their existing handling. A turning check caught an interaction with a pre-hop turn during development; excluding scripted routes from the new capture restored that sequence.

Simulator recording (preview removed) shows seven seconds of standing, turning and taking the first steps in the existing BrainPet Puzzle QA simulator, iPhone 18 Pro on iOS 27. It is a room crop sampled at 20 FPS and played at real time. Reviewed the departure frames for paw lift-off, body support and head/tail continuity. The game's clock control was set to Daytime for testing, retaining its Fast clock speed.

## Verification

`scripts/check-cat-starting.mjs` exercises short and long starts on all three coats at 30/60/120 FPS. It checks planted paw error, finite transforms, bounded movement between frames, prompt movement, head/tail response during the first stride, exact arrival and pause/resume. The preceding actor fails the new first-contact check. [Metrics](metrics.json) report the 60 FPS cases.

Standing-start, stopping, torso, fluid-motion, landing-to-walk, turning, room-flow and command-attention checks passed during this pass. TypeScript, ESLint and whitespace checks passed. No model assets were rebuilt.
