/**
 * UserLockManager — Asynchronous Mutex per User ID
 * 
 * Enforces serial, atomic execution of financial balance operations, wagers,
 * payouts, and withdrawals. Eliminates race conditions and double-spend exploits.
 * 
 * Hardened with:
 * - Queue depth saturation limits (rejects with 429 if too many concurrent operations pile up)
 * - Lock acquisition timeouts (aborts if queued too long)
 * - Task execution timeouts (guarantees next queued task is not starved if a query hangs)
 * - Zero-leak automatic map cleanup
 */
export class UserLockManager {
    constructor({
        maxQueueDepth = 25,
        acquireTimeoutMs = 6000,
        taskTimeoutMs = 12000
    } = {}) {
        this.queues = new Map() // userId -> Promise chain
        this.depths = new Map() // userId -> number of pending/running tasks
        this.maxQueueDepth = maxQueueDepth
        this.acquireTimeoutMs = acquireTimeoutMs
        this.taskTimeoutMs = taskTimeoutMs
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

        // 1. Guard against queue depth saturation (anti-flood protection)
        const currentDepth = this.depths.get(userId) || 0
        if (currentDepth >= this.maxQueueDepth) {
            const err = new Error(`Wallet busy: maximum concurrent operations (${this.maxQueueDepth}) reached for this account. Please wait.`)
            err.status = 429
            err.code = 'LOCK_QUEUE_SATURATED'
            throw err
        }

        this.depths.set(userId, currentDepth + 1)

        const currentQueue = this.queues.get(userId) || Promise.resolve()

        let release
        const nextInQueue = new Promise((resolve) => {
            release = resolve
        })

        // Always absorb rejections so previous task failure never poisons next task
        const waitPromise = currentQueue.catch(() => {})
        const queueTail = waitPromise.then(() => nextInQueue)
        this.queues.set(userId, queueTail)

        let acquired = false
        let acquireTimer = null

        try {
            // 2. Lock Acquisition with Timeout
            const acquirePromise = waitPromise.then(() => true)
            const timeoutPromise = new Promise((_, reject) => {
                acquireTimer = setTimeout(() => {
                    const err = new Error(`Failed to acquire wallet lock within ${this.acquireTimeoutMs}ms`)
                    err.status = 408
                    err.code = 'LOCK_ACQUISITION_TIMEOUT'
                    reject(err)
                }, this.acquireTimeoutMs)
                if (acquireTimer.unref) acquireTimer.unref()
            })

            await Promise.race([acquirePromise, timeoutPromise])
            acquired = true
            clearTimeout(acquireTimer)

            // 3. Task Execution with Safety Timeout
            let taskTimer = null
            const taskPromise = Promise.resolve().then(() => task())
            const taskTimeoutPromise = new Promise((_, reject) => {
                taskTimer = setTimeout(() => {
                    const err = new Error(`Wallet transaction exceeded maximum execution time of ${this.taskTimeoutMs}ms`)
                    err.status = 504
                    err.code = 'LOCK_TASK_TIMEOUT'
                    reject(err)
                }, this.taskTimeoutMs)
                if (taskTimer.unref) taskTimer.unref()
            })

            try {
                return await Promise.race([taskPromise, taskTimeoutPromise])
            } finally {
                clearTimeout(taskTimer)
            }
        } finally {
            if (acquireTimer) clearTimeout(acquireTimer)
            release()

            // Decrement depth and clean up map entries when queue drains to avoid memory leaks
            const newDepth = (this.depths.get(userId) || 1) - 1
            if (newDepth <= 0) {
                this.depths.delete(userId)
            } else {
                this.depths.set(userId, newDepth)
            }

            if (this.queues.get(userId) === queueTail) {
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

    /**
     * Returns the current queue depth for a given user
     */
    getUserQueueDepth(userId) {
        return this.depths.get(userId) || 0
    }
}

export const userLockManager = new UserLockManager()
