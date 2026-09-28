// Services with differently priced variants expose price as { min, max }.
export const getStartingPrice = (price) => {
    const value = price && typeof price === 'object' ? price.min : price;
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
};

export const formatServicePrice = (price, decimals) => {
    const format = (value) => decimals === undefined ? String(value) : value.toFixed(decimals);
    const min = getStartingPrice(price);
    const max = price && typeof price === 'object' ? getStartingPrice(price.max ?? min) : min;
    return min === max ? format(min) : `${format(min)} – $${format(max)}`;
};
