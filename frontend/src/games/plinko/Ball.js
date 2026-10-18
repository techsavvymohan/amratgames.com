// Custom Ball Physics - Deterministic Plinko Ball
// Uses padding system (×10000) for deterministic floating-point math
// x, y, vx, vy are all in PADDED space. Only unpad() when drawing.

const DECIMAL_MULTIPLIER = 10000;
const pad = (n) => n * DECIMAL_MULTIPLIER;
const unpad = (n) => Math.floor(n / DECIMAL_MULTIPLIER);

// Image cache for ball sprites
const imageCache = new Map();

function loadImage(src) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src);
    const img = new Image();
    img.src = src;
    imageCache.set(src, img);
    return img;
}

export class Ball {
    constructor(x, y, radius, color, ctx, obstacles, sinks, onFinish, gravity, hFriction, vFriction, ballImage, onCollidePin, targetBinIndex = null) {
        // x, y are already in PADDED space
        this.x = x;
        this.y = y;
        this.radius = radius;       // visual radius (unpadded)
        this.color = color;
        this.ballImage = ballImage ? loadImage(ballImage) : null;
        this.vx = 0;
        this.vy = 0;
        this.ctx = ctx;
        this.obstacles = obstacles;  // pins: { id, x (padded), y (padded), radius (unpadded) }
        this.sinks = sinks;          // buckets: { x, y, width, height } (unpadded)
        this.onFinish = onFinish;
        this.onCollidePin = onCollidePin;
        this.targetBinIndex = targetBinIndex;
        this.finished = false;
        this.id = Math.random().toString(36).substr(2, 9);
        this.createdAt = Date.now();
        this.stuckCounter = 0;

        // Physics constants (configurable per rowCount)
        this.gravity = gravity || pad(0.6);
        this.horizontalFriction = hFriction || 0.4;
        this.verticalFriction = vFriction || 0.8;
    }

    draw() {
        if (this.finished) return;
        const ux = unpad(this.x);
        const uy = unpad(this.y);
        const r = this.radius;

        if (this.ballImage && this.ballImage.complete) {
            // Draw SVG/image centered
            this.ctx.drawImage(this.ballImage, ux - r, uy - r, r * 2, r * 2);
        } else {
            // Fallback: draw colored circle with subtle shadow/glow
            this.ctx.beginPath();
            this.ctx.arc(ux, uy, r, 0, Math.PI * 2);
            this.ctx.fillStyle = this.color || '#ff4d4f';
            this.ctx.fill();
            this.ctx.closePath();
        }
    }

    update() {
        if (this.finished) return;

        // Apply gravity (padded)
        this.vy += this.gravity;

        // Anti-stuck watchdog: if ball has negligible movement, apply a gentle downward push
        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq < pad(0.05)) {
            this.stuckCounter++;
            if (this.stuckCounter > 15) {
                this.vy += pad(1.2);
                this.vx += pad((Math.random() - 0.5) * 1.5);
                this.stuckCounter = 0;
            }
        } else {
            this.stuckCounter = 0;
        }

        // Target bin soft convergence in the lower half of the board
        const uyCurrent = unpad(this.y);
        if (this.targetBinIndex !== null && this.sinks && this.sinks[this.targetBinIndex]) {
            const targetSink = this.sinks[this.targetBinIndex];
            const targetXPadded = pad(targetSink.x);
            // In the bottom 35% of the board, gently guide ball horizontally to eliminate desync
            if (uyCurrent > 280) {
                const diffX = targetXPadded - this.x;
                this.vx += diffX * 0.025;
            }
        }

        // Update position (padded)
        this.x += this.vx;
        this.y += this.vy;

        // Collision with obstacles (pins)
        for (const obstacle of this.obstacles) {
            const dx = this.x - obstacle.x;
            const dy = this.y - obstacle.y;
            const dist = Math.hypot(dx, dy);
            const minDist = pad(this.radius + obstacle.radius);

            if (dist < minDist && dist > 0) {
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

                // Reflect with friction
                this.vx = Math.cos(angle) * speed * this.horizontalFriction;
                this.vy = Math.sin(angle) * speed * this.verticalFriction;

                // Push out to prevent sticking
                const overlap = this.radius + obstacle.radius - unpad(dist);
                this.x += pad(Math.cos(angle) * Math.max(overlap, 0.5));
                this.y += pad(Math.sin(angle) * Math.max(overlap, 0.5));

                // Notify collision manager for UI animations
                if (this.onCollidePin && obstacle.id) {
                    this.onCollidePin(obstacle.id);
                }
            }
        }

        // Check sinks (buckets) — sinks are in UNPADDED space
        const ux = unpad(this.x);
        const uy = unpad(this.y);

        if (this.sinks && this.sinks.length > 0) {
            const firstSink = this.sinks[0];
            // Allow the ball to visually drop inside the bin opening before finishing
            const sinkYThreshold = firstSink.y - firstSink.height * 0.2;

            // Target bin takes absolute precedence if ball has crossed vertical threshold
            if (uy >= sinkYThreshold) {
                const settledBin = (this.targetBinIndex !== null && this.targetBinIndex >= 0 && this.targetBinIndex < this.sinks.length)
                    ? this.targetBinIndex
                    : (() => {
                        let closestIndex = 0;
                        let minDistance = Infinity;
                        for (let i = 0; i < this.sinks.length; i++) {
                            const dist = Math.abs(ux - this.sinks[i].x);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestIndex = i;
                            }
                        }
                        return closestIndex;
                    })();

                this.vx = 0;
                this.vy = 0;
                this.finished = true;
                this.onFinish(settledBin);
                return;
            }
        }

        // Failsafe 2: Generous watchdog timeout (25s maximum drop duration to prevent memory leaks, NEVER vanishing mid-air)
        if (Date.now() - this.createdAt > 25000) {
            const fallbackBin = (this.targetBinIndex !== null && this.targetBinIndex >= 0)
                ? this.targetBinIndex
                : (this.sinks && this.sinks.length > 0 ? Math.floor(this.sinks.length / 2) : 0);
            this.vx = 0;
            this.vy = 0;
            this.finished = true;
            this.onFinish(fallbackBin);
        }
    }

    isFinished() {
        return this.finished;
    }
}

export { pad, unpad, DECIMAL_MULTIPLIER };
export default Ball;
