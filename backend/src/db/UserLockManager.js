/**
 * UserLockManager — Asynchronous Mutex per User ID
 * 
 * Enforces serial, atomic execution of financial balance operations, wagers,
 * payouts, and withdrawals. Eliminates race conditions and double-spend exploits
 * when concurrent requests target the same player wallet.
 */
export class UserLockManager {
    constructor() {
        this.queues = new Map() // userId -> Promise chain
    }

    /**
     * Executes `task` inside an exclusive atomic lock for `userId`.
     * If multiple concurrent requests arrive for the same user, they execute
     * strictly sequentially in FIFO order.
     * 
     * @param {string} userId - The unique identifier of the user to lock
     * @param {Function} task - Async callback function to execute inside the lock
     * @returns {Promise<*>} Result of the task
     */
    async withLock(userId, task) {
        if (!userId) {
            return task()
        }

        const currentQueue = this.queues.get(userId) || Promise.resolve()

        let release
        const nextInQueue = new Promise((resolve) => {
            release = resolve
        })

        // Always absorb rejections so previous task failure never poisons next task
        const waitPromise = currentQueue.catch(() => {})
        this.queues.set(userId, waitPromise.then(() => nextInQueue))

        try {
            // Await previous lock holder before running task
            await waitPromise
            return await task()
        } finally {
            release()
            // Clean up map entry when the queue drains to avoid memory leaks
            if (this.queues.get(userId) === nextInQueue) {
                this.queues.delete(userId)
            }
        }
    }

    /**
     * Returns the number of currently active locks (useful for health diagnostics)
     */
    getActiveLockCount() {
        return this.queues.size
    }
}

export const userLockManager = new UserLockManager()
