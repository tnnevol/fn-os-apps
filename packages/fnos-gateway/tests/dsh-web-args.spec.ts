import { describe, expect, it } from 'vitest'
import { buildDshWebArgs } from '../src/dsh-web-args.ts'

describe('DSH web command arguments', () => {
  it('prevents the service from opening a browser and forwards trusted hosts', () => {
    expect(buildDshWebArgs({
      host: '127.0.0.1',
      port: 3080,
      trustedHosts: ['fnos.example.com', '192.168.1.20:5666'],
    })).toEqual([
      'web',
      '--no-open',
      '--host', '127.0.0.1',
      '--port', '3080',
      '--trusted-host', 'fnos.example.com',
      '--trusted-host', '192.168.1.20:5666',
    ])
  })
})
