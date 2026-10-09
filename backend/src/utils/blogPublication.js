const Blog = require('../models/Blog');
const publishDue = () => Blog.updateMany(
    { scheduledAt: { $lte: new Date(), $ne: null }, isArchived: { $ne: true } },
    { $set: { isPublished: true, scheduledAt: null } }
);
function startBlogPublication() {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try { await publishDue(); } catch (err) { console.error('Scheduled blog publication failed:', err.message); }
        finally { running = false; }
    };
    tick();
    const timer = setInterval(tick, 30000);
    timer.unref();
    return () => clearInterval(timer);
}
module.exports = { publishDue, startBlogPublication };
