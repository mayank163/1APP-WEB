Admin styling
=============

`main.css` is imported once by `src/index.js`, after Bootstrap and Toastify.
It owns the shared color palette, font stacks, font sizes, spacing values,
base typography, brand buttons, utility classes, and shared loading animation.
Change shared values in its `:root` block to update their consumers together.
The existing variants are intentional: this refactor preserves each page's appearance.

All page and component styles live in this folder and are imported by their
owning page/component. Add new presentation rules here, rather than in JSX.
Use shared tokens with `var(--admin-color-brand)`, for example.

Extracted `admin-*` classes are scoped to their owning component. Repeated
class selectors preserve the precedence that inline styles previously had,
without overriding existing Bootstrap `!important` utilities.
`*-state-*` classes hold conditional presentation values.

JSX only supplies runtime measurements (header height, progress percentages,
image dimensions) through CSS custom properties. Reusable image and skeleton
components still accept caller style overrides for compatibility.

`InvoiceDocument.css` is also read through CSSOM by `invoiceStyles.js` so
printed and downloaded invoices include the same CSS and shared variables.
`AppLegacy.css` preserves the original unused Create React App stylesheet.
