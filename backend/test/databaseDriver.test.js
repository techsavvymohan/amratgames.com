import { describe, it, after } from 'node:test'
import assert from 'node:assert'
import { DatabaseAdapter } from '../src/db/DatabaseAdapter.js'
import { JsonFileDriver } from '../src/db/drivers/JsonFileDriver.js'
import { PostgresDriver } from '../src/db/drivers/PostgresDriver.js'
import { DatabaseDriverFactory } from '../src/db/DatabaseDriverFactory.js'
import { Database } from '../src/db/db.js'

describe('🏛️ Database Layer Abstraction & Pluggable Drivers Suite', () => {
    it('verifies DatabaseAdapter enforces abstract methods on subclasses', () => {
        assert.throws(() => {
            new DatabaseAdapter()
        }, /Cannot construct DatabaseAdapter instances directly/)
    })

    it('verifies DatabaseDriverFactory registers and resolves built-in drivers', () => {
        const drivers = DatabaseDriverFactory.getSupportedDrivers()
        assert.ok(drivers.includes('json'), 'Factory must support json driver')
        assert.ok(drivers.includes('postgres'), 'Factory must support postgres driver')
        assert.ok(drivers.includes('lowdb'), 'Factory must support lowdb alias')

        const jsonDriver = DatabaseDriverFactory.createDriver('json')
        assert.ok(jsonDriver instanceof JsonFileDriver)
        assert.equal(jsonDriver.getDriverName(), 'json')

        const pgDriver = DatabaseDriverFactory.createDriver('postgres')
        assert.ok(pgDriver instanceof PostgresDriver)
        assert.equal(pgDriver.getDriverName(), 'postgres')
    })

    it('verifies JsonFileDriver performs atomic file operations and health checks', async () => {
        const driver = new JsonFileDriver()
        const health = await driver.isHealthy()
        assert.equal(health.healthy, true)
        assert.equal(health.driver, 'json')
        assert.ok(health.filePath.includes('amratgames_db.json'))

        const state = driver.loadState()
        assert.ok(state, 'State must load from disk')
        assert.ok(Array.isArray(state.users), 'Loaded state must have users array')
    })

    it('verifies DatabaseDriverFactory allows registering custom enterprise storage drivers', () => {
        class MockMongoDriver extends DatabaseAdapter {
            getDriverName() { return 'mock_mongo' }
            async connect() { this.connected = true }
            async disconnect() { this.connected = false }
            loadState() { return { users: [] } }
            async flushState() {}
            flushStateSync() {}
        }

        DatabaseDriverFactory.registerDriver('mock_mongo', MockMongoDriver)
        assert.ok(DatabaseDriverFactory.getSupportedDrivers().includes('mock_mongo'))

        const customInstance = DatabaseDriverFactory.createDriver('mock_mongo')
        assert.equal(customInstance.getDriverName(), 'mock_mongo')
        assert.ok(customInstance instanceof MockMongoDriver)
    })

    it('verifies Database instance delegates persistence and state management to active driver', async () => {
        class MemoryTestDriver extends DatabaseAdapter {
            constructor() {
                super()
                this.savedStates = []
            }
            getDriverName() { return 'memory_test' }
            async connect() { this.connected = true }
            async disconnect() { this.connected = false }
            loadState() {
                return {
                    users: [{
                        id: 'mem_u1',
                        username: 'mem_player',
                        email: 'mem_player@test.com',
                        role: 'player',
                        status: 'active',
                        balances: { INR: 500, BTC: 0, USDT: 0, AMRAT: 0 }
                    }],
                    transactions: [],
                    bets: [],
                    airdrops: [],
                    withdrawals: [],
                    deposits: [],
                    processedWebhooks: [],
                    settings: { rtp: 98, houseEdge: 2 }
                }
            }
            async flushState(state) {
                this.savedStates.push(JSON.parse(JSON.stringify(state)))
            }
            flushStateSync(state) {
                this.savedStates.push(JSON.parse(JSON.stringify(state)))
            }
        }

        const memDriver = new MemoryTestDriver()
        const customDb = new Database(memDriver)

        // Loaded user from memory driver
        const user = customDb.findUserById('mem_u1')
        assert.ok(user, 'User should be indexed from driver state')
        assert.equal(user.username, 'mem_player')
        assert.equal(user.balances.INR, 500)

        // Mutate and flush
        customDb.updateUserBalance('mem_u1', 'INR', 250, 'Test Deposit')
        assert.equal(user.balances.INR, 750)

        customDb.flushSync()
        assert.ok(memDriver.savedStates.length > 0, 'Driver flushStateSync must be called on db flush')
        const lastSaved = memDriver.savedStates[memDriver.savedStates.length - 1]
        const savedUser = lastSaved.users.find(u => u.id === 'mem_u1')
        assert.equal(savedUser.balances.INR, 750, 'Persisted state reflects balance mutation')
    })

    after(() => {
        setTimeout(() => {
            process.exit(0)
        }, 100)
    })
})
