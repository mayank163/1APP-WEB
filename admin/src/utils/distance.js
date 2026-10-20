// API service radii and routing distances are stored in kilometers.
export const MILES_PER_KILOMETER = 1 / 1.609344;
export const kilometersToMiles = value => Number(value) * MILES_PER_KILOMETER;
export const milesToKilometers = value => Number(value) / MILES_PER_KILOMETER;
export const formatMiles = kilometers => `${kilometersToMiles(kilometers).toFixed(1)} miles`;
