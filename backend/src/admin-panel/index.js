import { createAdminRouter } from './routes/admin.routes.js'
import { AdminController } from './controllers/AdminController.js'
import { AdminUserManager } from './services/AdminUserManager.js'
import { TokenDistributionEngine } from './services/TokenDistributionEngine.js'
import { PlatformAnalyticsService } from './services/PlatformAnalyticsService.js'
import { GameEngineManager } from './services/GameEngineManager.js'
import { UserEntity } from './models/UserEntity.js'
import { AirdropEntity } from './models/AirdropEntity.js'

/**
 * AdminPanelModule — Portable, self-contained OOP Admin subsystem
 */
export class AdminPanelModule {
    constructor() {
        this.controller = new AdminController()
        this.router = createAdminRouter()
    }

    getRouter() {
        return this.router
    }

    getController() {
        return this.controller
    }
}

// Export singleton instance
export const adminPanelModule = new AdminPanelModule()
export default adminPanelModule

// Export classes for external extensibility
export {
    AdminController,
    AdminUserManager,
    TokenDistributionEngine,
    PlatformAnalyticsService,
    GameEngineManager,
    UserEntity,
    AirdropEntity
}
