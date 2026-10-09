# Frontend styling

`main.css` is imported once in `src/index.js`, after Bootstrap and Toastify. It
owns the shared typography, colors, spacing, utilities, and design tokens.
Start with the named `--ui-font-family-*`, `--ui-font-size-*`, and `--ui-color-*`
variables in its `:root` block. Exact-value tokens preserve the existing page
sizes and spacing; changing a token updates every declaration using it.

All page and component CSS belongs in this folder. Import the matching CSS file
from its page or component. Keep layout selectors local to that page/component.
Do not add CSS objects or `<style>` blocks to JSX.

The numbered `ui-*` classes are the existing inline styles moved without changing
their values. Their `:not(#ui-style-priority)` selectors preserve the priority of
those declarations over ordinary selectors, while existing `!important`
responsive/Bootstrap rules still win. Do not use those reserved IDs on elements.

React passes changing values (progress, selected states, measured positions,
etc.) through CSS custom properties. `utils/cssValue.js` keeps React's numeric
pixel/unitless behavior. Fixed declarations belong in the CSS files. Reusable
components accept class names for styling their wrapper or input.

`InvoiceDocument.css` is also reused for self-contained downloaded and printed
invoices through `getInvoiceStyles`; the HTML export embeds the loaded CSS.
