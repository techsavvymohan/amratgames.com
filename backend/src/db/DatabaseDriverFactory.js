import { JsonFileDriver } from './drivers/JsonFileDriver.js'
import { PostgresDriver } from './drivers/PostgresDriver.js'
import { CONFIG } from '../config.js'

/**
 * 🏭 DatabaseDriverFactory
 * Resolves and instantiates the appropriate storage engine based on runtime configuration.
 */
export class DatabaseDriverFactory {
    static registry = new Map([
        ['json', JsonFileDriver],
        ['file', JsonFileDriver],
        ['lowdb', JsonFileDriver],
        ['postgres', PostgresDriver],
        ['postgresql', PostgresDriver]
    ])

    /**
     * Register a custom storage driver
     * @param {string} name
     * @param {typeof import('./DatabaseAdapter.js').DatabaseAdapter} driverClass
     */
    static registerDriver(name, driverClass) {
        this.registry.set(name.toLowerCase(), driverClass)
    }

    /**
     * Create or retrieve a database driver instance
     * @param {string} [requestedDriver]
     * @param {object} [options]
     * @returns {import('./DatabaseAdapter.js').DatabaseAdapter}
     */
    static createDriver(requestedDriver, options = {}) {
        const driverName = (requestedDriver || CONFIG.DB_DRIVER || 'json').toLowerCase()
        const DriverClass = this.registry.get(driverName)

        if (!DriverClass) {
            console.warn(`[DriverFactory] Unknown driver "${driverName}", defaulting to "json" (JsonFileDriver)`)
            return new JsonFileDriver(options)
        }

        return new DriverClass(options)
    }

    /**
     * List all supported driver identifiers
     * @returns {string[]}
     */
    static getSupportedDrivers() {
        return Array.from(this.registry.keys())
    }
}

export default DatabaseDriverFactory
