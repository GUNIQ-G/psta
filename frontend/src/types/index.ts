export enum ItemType {
  PROJECT = 'PROJECT',
  SERVICE = 'SERVICE',
  TEAM = 'TEAM',
  ACTION = 'ACTION',
}

export enum ItemStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  PO = 'PO',
  PM = 'PM',
  MEMBER = 'MEMBER',
}

export interface Team {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  ldapDn?: string;
  authType?: string;
  isVerified: boolean;
  isActive?: boolean;
  approvalRequested?: boolean;
  approvalRequestedAt?: string;
  approvalMessage?: string;
  role: UserRole;
  teamId?: string;
  createdAt?: string;
  updatedAt?: string;
  Team?: Team | null;
}

export interface Permission {
  id: string;
  role: UserRole;
  resource: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionsMap {
  [resource: string]: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  };
}

export interface Client {
  id: string;
  name: string;
  code: string;
  phone?: string;
  email?: string;
  businessNumber?: string;
  representative?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceTeam {
  id: string;
  serviceId: string;
  teamId: string;
  Team?: Team;
  Item?: any; // Service Item
  createdAt?: string;
  updatedAt?: string;
}

export interface Item {
  id: string;
  type: ItemType;
  name: string;
  status: ItemStatus;
  progress: number;
  isOnHold: boolean;
  startDate?: string;
  endDate?: string;
  timeSpent: number;
  description?: string;
  order: number;
  clientId?: string;
  Client?: Client;
  parentId?: string;
  serviceTeamId?: string;
  ServiceTeam?: ServiceTeam;
  Item?: Item;
  parent?: Item;
  children?: Item[];
  other_Item?: Item[];
  assigneeId?: string;
  User_Item_assigneeIdToUser?: User;
  createdById: string;
  createdBy?: User;
  User_Item_createdByIdToUser?: User;
  createdAt: string;
  updatedAt: string;
  _count?: {
    Comment: number;
    File: number;
    Link: number;
  };
  WorkRequest?: {
    id: string;
    title: string;
    description: string;
    priority: WorkRequestPriority;
    status: WorkRequestStatus;
    dueDate?: string;
    createdAt: string;
    Requester?: {
      id: string;
      username: string;
      displayName: string;
      email: string;
    };
    Assignee?: {
      id: string;
      username: string;
      displayName: string;
      email: string;
    };
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Comment {
  id: string;
  content: string;
  itemId: string;
  userId: string;
  User?: User;
  reactions?: string; // JSON string: {"👍": ["userId1", "userId2"], "❤️": ["userId3"]}
  reactionsWithUsers?: string; // JSON string: {"👍": [{userId: "id1", displayName: "name1"}], "❤️": [...]}
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: string;
  content: string;
  itemId?: string;
  commentId?: string;
  fromUserId: string;
  toUserId: string;
  isRead: boolean;
  createdAt: string;
  FromUser?: User;
}

export interface Message {
  id: string;
  subject: string;
  content: string;
  fromUserId: string;
  toUserId: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  FromUser?: User;
  ToUser?: User;
}

export interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  filepath: string;
  filesize: number;
  mimetype: string;
  itemId: string;
  projectId?: string;
  serviceId?: string;
  teamId?: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
  UploadedBy?: {
    id: string;
    username: string;
    displayName: string;
  };
  Item?: Item;
}

export interface Link {
  id: string;
  url: string;
  displayName: string;
  itemId: string;
  projectId?: string;
  serviceId?: string;
  teamId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy?: {
    id: string;
    username: string;
    displayName: string;
  };
  Item?: Item;
}

export interface SystemSettings {
  systemName?: string;
  systemDescription?: string;
  systemLogo?: string;
  copyrightText?: string;
  [key: string]: string | undefined;
}

export enum WorkRequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
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
}

export interface WorkRequest {
  id: string;
  title: string;
  description: string;
  priority: WorkRequestPriority;
  status: WorkRequestStatus;
  projectId?: string;
  serviceId?: string;
  teamId?: string;
  dueDate?: string;
  requesterId: string;
  assigneeId?: string;
  assigneeTeamId?: string;
  isRecalled: boolean;
  isApproved: boolean;
  approvedAt?: string;
  approvedById?: string;
  rejectedAt?: string;
  rejectedById?: string;
  rejectionMessage?: string;
  negotiationMessage?: string;
  negotiationAt?: string;
  negotiationById?: string;
  actionId?: string;

  // Hierarchical workflow fields
  requestType: WorkRequestType;
  parentWorkRequestId?: string;
  targetItemType?: ItemType;
  createdItemId?: string;

  createdAt: string;
  updatedAt: string;
  Requester?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
  Assignee?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
  AssigneeTeam?: {
    id: string;
    name: string;
    description?: string;
  };
  ApprovedBy?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
  Action?: Item;
  Project?: {
    id: string;
    name: string;
  };
  Service?: {
    id: string;
    name: string;
  };
  Team?: {
    id: string;
    name: string;
  };

  // Hierarchical workflow relations
  ParentWorkRequest?: WorkRequest;
  ChildWorkRequests?: WorkRequest[];
  CreatedItem?: Item;
}