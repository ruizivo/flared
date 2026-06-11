export interface Account {
  id: string
  name: string
  apiToken: string
}

export interface Hostname {
  id: string
  hostname: string
  service: string
  noTLSVerify: boolean
  httpHostHeader: string
  active: boolean
  cfZoneId: string
}

export interface Tunnel {
  id: string
  tunnelId: string
  name: string
  active: boolean
  accountId: string
  credentialsFile: string
  hostnames: Hostname[]
}

export interface AppConfig {
  accounts: Account[]
  tunnels: Tunnel[]
}

export interface CloudflaredIngress {
  hostname?: string
  service: string
  originRequest?: {
    noTLSVerify?: boolean
    httpHostHeader?: string
  }
}

export interface CloudflaredConfig {
  tunnel: string
  'credentials-file': string
  ingress: CloudflaredIngress[]
}

export interface CloudflareApiRecord {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean
}

export interface CfZone {
  id: string
  name: string
}
