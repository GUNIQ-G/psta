export enum UserRole {
  ADMIN = 'ADMIN',
  PO = 'PO',
  PM = 'PM',
  MEMBER = 'MEMBER',
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  ldapDn?: string;
  role: UserRole;
  teamId?: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  Team?: Team;
}

export interface Team {
  id: string;
  name: string;
  ldapDn?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  User?: User[];
}

export interface LDAPSyncResult {
  created: number;
  updated: number;
  errors: string[];
}
