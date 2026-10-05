// Kost/utils/cooldown.js - In-memory cooldown manager for rate limiting public commands
const cooldowns = new Map();

function checkCooldown(key, durationSeconds = 10) {
    const now = Date.now();
    const expiresAt = cooldowns.get(key);

    if (expiresAt && now < expiresAt) {
        const remainingMs = expiresAt - now;
        return {
            allowed: false,
            remainingSeconds: Math.ceil(remainingMs / 1000)
        };
    }

    cooldowns.set(key, now + (durationSeconds * 1000));
    return {
        allowed: true,
        remainingSeconds: 0
    };
}

module.exports = {
    checkCooldown
};
