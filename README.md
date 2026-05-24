# Group DMs Tab

Vencord plugin that adds a `Groups` tab to the Friends view and toggles group DM visibility.

## Files

- `index.ts` - plugin entry point

## Behavior

- Group DMs are hidden by default.
- Clicking the `Groups` tab toggles them open/closed.
- The tab shows `(hidden)` / `(open)` status.

## Notes

- This is written as a Vencord plugin using the boilerplate from `definePlugin`.
- If your client skin uses different DOM classes, the selectors may need a small tweak.