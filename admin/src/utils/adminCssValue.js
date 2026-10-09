// Preserve React's pixel conversion when passing runtime dimensions to CSS variables.
export const adminCssValue = value => typeof value === 'number' && value !== 0 ? value + 'px' : value;
