import '../../styles/InvoiceDocument.css';

// Reuse the loaded stylesheet in standalone downloaded and printed invoices.
export const getInvoiceStyles = () => Array.from(document.styleSheets).flatMap(sheet => {
    try {
        return Array.from(sheet.cssRules)
            .filter(rule => rule.cssText.includes('invoice-') || rule.cssText.includes('--admin-font-family:') || rule.cssText.startsWith('@page'))
            .map(rule => rule.cssText);
    } catch {
        // Cross-origin vendor/font stylesheets are not needed by the invoice.
        return [];
    }
}).join('\n');
