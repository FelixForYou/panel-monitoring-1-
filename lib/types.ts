export type ApiItem<T = Record<string, unknown>> = {
  object: string;
  attributes: T;
};

export type PteroUser = {
  id: number;
  external_id?: string | null;
  uuid?: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  language?: string;
  root_admin: boolean;
  '2fa'?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PteroServer = {
  id: number;
  external_id?: string | null;
  uuid: string;
  identifier: string;
  name: string;
  description?: string;
  status?: string | null;
  suspended: boolean;
  user: number;
  node: number;
  allocation?: number;
  nest?: number;
  egg?: number;
  limits?: {
    memory?: number;
    swap?: number;
    disk?: number;
    io?: number;
    cpu?: number;
    threads?: string | null;
    oom_disabled?: boolean;
  };
  feature_limits?: {
    databases?: number;
    allocations?: number;
    backups?: number;
  };
  created_at?: string;
  updated_at?: string;
  relationships?: Record<string, unknown>;
  [key: string]: unknown;
};

export type PteroNode = {
  id: number;
  uuid?: string;
  public?: boolean;
  name: string;
  description?: string | null;
  location_id?: number;
  fqdn: string;
  scheme?: string;
  behind_proxy?: boolean;
  maintenance_mode?: boolean;
  memory?: number;
  memory_overallocate?: number;
  disk?: number;
  disk_overallocate?: number;
  upload_size?: number;
  daemon_listen?: number;
  daemon_sftp?: number;
  daemon_base?: string;
  created_at?: string;
  updated_at?: string;
};

export type PteroLocation = {
  id: number;
  short: string;
  long?: string;
  created_at?: string;
  updated_at?: string;
};
