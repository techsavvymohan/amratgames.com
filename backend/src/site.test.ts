import { describe, it, expect } from 'vitest'
import { SITE_NAME, SITE_DOMAIN, CONTACT_EMAIL } from './lib/site'
import fs from 'node:fs'
import path from 'node:path'

describe('AmratGames.com Platform Tests', () => {
  it('has correct branding in site.ts', () => {
    expect(SITE_NAME).toBe('Amrat Games')
    expect(SITE_DOMAIN).toBe('AmratGames.com')
    expect(CONTACT_EMAIL).toBe('support@amratgames.com')
  })

  it('verifies royal gold and obsidian black theme tokens in styles.css', () => {
    const cssPath = path.resolve(__dirname, 'styles.css')
    const css = fs.readFileSync(cssPath, 'utf-8')
    expect(css).toContain('--color-pit: #08080c')
    expect(css).toContain('--color-mint: #f5af19')
    expect(css).toContain('--color-mintdeep: #d49110')
    expect(css).toContain('gold-gradient-text')
  })

  it('verifies logo asset exists in public directory', () => {
    const logoPath = path.resolve(__dirname, '../public/amrat-logo.png')
    expect(fs.existsSync(logoPath)).toBe(true)
    const stats = fs.statSync(logoPath)
    expect(stats.size).toBeGreaterThan(100000)
  })

  it('verifies all 9 AmratGames.com GraphQL API operations are integrated', () => {
    const apiExplorerPath = path.resolve(__dirname, 'routes/api-explorer.tsx')
    const content = fs.readFileSync(apiExplorerPath, 'utf-8')
    expect(content).toContain('active_bets')
    expect(content).toContain('balance')
    expect(content).toContain('highrollers')
    expect(content).toContain('bet_history')
    expect(content).toContain('trending')
    expect(content).toContain('transactions')
    expect(content).toContain('tips')
    expect(content).toContain('send_tip')
    expect(content).toContain('withdrawal')
  })
})
