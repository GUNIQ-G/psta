export enum UserRole {
  ADMIN = 'ADMIN',
  PO = 'PO',
  PM = 'PM',
  MEMBER = 'MEMBER',
}

export enum PositionType {
  NONE = 'NONE',
  PART_LEADER = 'PART_LEADER',
  TEAM_LEADER = 'TEAM_LEADER',
  DIRECTOR = 'DIRECTOR',
  HEAD = 'HEAD',
  EXECUTIVE = 'EXECUTIVE',
  SENIOR_EXEC = 'SENIOR_EXEC',
  VICE_PRES = 'VICE_PRES',
}

export enum ItemStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
}

export enum ItemType {
  PROJECT = 'PROJECT',
  SERVICE = 'SERVICE',
  TEAM = 'TEAM',
  ACTION = 'ACTION',
}

export enum WorkRequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  IN_NEGOTIATION = 'IN_NEGOTIATION',
}

export enum WorkRequestType {
  ACTION_REQUEST = 'ACTION_REQUEST',
  SERVICE_CREATE = 'SERVICE_CREATE',
  TEAM_CREATE = 'TEAM_CREATE',
  IN_NEGOTIATION = 'IN_NEGOTIATION',
}

export enum WorkRequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum OrgType {
  COMPANY = 'COMPANY',
  DIVISION = 'DIVISION',
  DEPARTMENT = 'DEPARTMENT',
  TEAM = 'TEAM',
}

export enum FeedbackType {
  BUG = 'BUG',
  FEATURE = 'FEATURE',
  IMPROVEMENT = 'IMPROVEMENT',
}

export enum FeedbackStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum NotificationAppType {
  SLACK = 'SLACK',
  TELEGRAM = 'TELEGRAM',
  DISCORD = 'DISCORD',
  LINE = 'LINE',
  KAKAOTALK = 'KAKAOTALK',
}
