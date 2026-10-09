import '../../styles/InvoiceDocument.css';

// Keep downloaded and printed documents self-contained with the same CSS.
export const getInvoiceStyles = () => Array.from(document.styleSheets).flatMap(sheet => {
    try {
        return Array.from(sheet.cssRules)
            .filter(rule => rule.cssText.includes('invoice-') || rule.cssText.startsWith('@page') || (rule.selectorText === ':root' && rule.cssText.includes('--ui-')))
            .map(rule => rule.cssText);
    } catch {
        // Cross-origin font/vendor stylesheets are not needed by the invoice.
        return [];
    }
}).join('\n');
