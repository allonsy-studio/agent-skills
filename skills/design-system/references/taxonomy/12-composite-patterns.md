# Composite Patterns

Some interfaces combine multiple primitives into a recognizable higher-level
pattern. These don't always have a single ARIA role — they're assembled from
the pieces above.

| Composite             | Built from                                      |
| --------------------- | ----------------------------------------------- |
| Search                | Text input + button + listbox (autocomplete)    |
| Command palette       | Combobox + grouped list of actions              |
| Data table            | Table + pagination + sort buttons + filters     |
| Multi-select          | Combobox + tag list                             |
| Wizard / Stepper flow | Tabs or step indicator + form + navigation      |
| Filter bar            | Tag group + dropdown menus + button (clear all) |
| Notification center   | Button (trigger) + popover + list of toasts     |
| Form field            | Label + input + help text + error message        |
| Card grid             | Grid layout + cards + pagination                |
| App shell             | Header + sidebar nav + main content area        |
| Settings page         | Navigation (sidebar/tabs) + form fields + save  |
| Color picker          | 2D gradient + sliders + text inputs + swatches  |
| Nested menu           | Menu + sub-menus + menuitemcheckbox/radio        |
