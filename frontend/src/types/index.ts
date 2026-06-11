export interface Account {
  id: string
  name: string
  apiToken: string
  zoneCount?: number
}

export interface CfZone {
  id: string
  name: string
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
  running: boolean
  credentialsFile: string
  hostnames: Hostname[]
}

export interface SetupStatus {
  hasCert: boolean
  hasTunnels: boolean
  certPath: string
}

export interface CloudflareTunnel {
  tunnelId: string
  name: string
  status: string
  createdAt: string
  imported: boolean
  hasCredentials: boolean
}
