# Marching UI

React components and routes for the simulator UI.

- `components/` – presentational and container components
- `page.tsx` – entry point

Manual test:
- Open /marching
- Try commands: FALL IN, FORWARD MARCH, HALT, LEFT FACE, RIGHT FLANK, TO THE REAR
- Observe JSON state updates and errors for out-of-context commands.
- Use the Scenario selector to Load and Step through demo scripts from `lib/marching/fixtures/sample-scenarios.ts`.

## Command cadence

- Commands with preparatory/execution words now fire on-beat: preparatory on beat 0, a silent beat, then execution on beat 2 with the maneuver applied on that execution beat.
- HALT includes two follow-on beats (“Step”, then “Stop”) to match the final marching footfalls after the command of execution.
- A cadence overlay shows the current/next callouts with beat numbers, and the browser SpeechSynthesis API voices the callouts on-beat for quick visualization. If the browser has no speech engine, the overlay still advances visually.
