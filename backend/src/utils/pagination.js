const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const getPagination = (query = {}) => {
    const requestedPage = Number.parseInt(query.page, 10);
    const requestedLimit = Number.parseInt(query.limit, 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : DEFAULT_PAGE;
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
};

const getPaginationMeta = ({ page, limit, total }) => ({
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
});

module.exports = { getPagination, getPaginationMeta };
