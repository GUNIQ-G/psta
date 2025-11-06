--
-- PostgreSQL database dump
--

\restrict qIwzcncWatdZfjhwe26VbLi9u6yNpaav2BvbzS0bijouLAZn8m665HttqrC8Bvt

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ItemStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ItemStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'ON_HOLD'
);


--
-- Name: ItemType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ItemType" AS ENUM (
    'PROJECT',
    'SERVICE',
    'TEAM',
    'ACTION'
);


--
-- Name: NotificationAppType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationAppType" AS ENUM (
    'SLACK',
    'TELEGRAM',
    'DISCORD',
    'LINE',
    'KAKAOTALK'
);


--
-- Name: OrgType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrgType" AS ENUM (
    'COMPANY',
    'DIVISION',
    'DEPARTMENT',
    'TEAM'
);


--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'PO',
    'PM',
    'MEMBER'
);


--
-- Name: WorkRequestPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkRequestPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: WorkRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkRequestStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'REJECTED',
    'IN_NEGOTIATION'
);


--
-- Name: WorkRequestType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkRequestType" AS ENUM (
    'ACTION_REQUEST',
    'SERVICE_CREATE',
    'TEAM_CREATE',
    'IN_NEGOTIATION'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    phone text,
    email text,
    "businessNumber" text,
    representative text,
    address text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "logoUrl" text
);


--
-- Name: Comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    content text NOT NULL,
    "itemId" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    reactions text DEFAULT '{}'::text
);


--
-- Name: File; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."File" (
    id text NOT NULL,
    filename text NOT NULL,
    "originalName" text NOT NULL,
    filepath text NOT NULL,
    filesize integer NOT NULL,
    mimetype text NOT NULL,
    "itemId" text NOT NULL,
    "projectId" text,
    "serviceId" text,
    "teamId" text,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Item" (
    id text NOT NULL,
    type public."ItemType" NOT NULL,
    name text NOT NULL,
    status public."ItemStatus" DEFAULT 'NOT_STARTED'::public."ItemStatus" NOT NULL,
    progress double precision DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "timeSpent" double precision DEFAULT 0 NOT NULL,
    description text,
    "order" integer DEFAULT 0 NOT NULL,
    "clientId" text,
    "parentId" text,
    "assigneeId" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isOnHold" boolean DEFAULT false NOT NULL
);


--
-- Name: LdapConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LdapConfig" (
    id text NOT NULL,
    name text NOT NULL,
    host text NOT NULL,
    port integer DEFAULT 389 NOT NULL,
    protocol text DEFAULT 'LDAP'::text NOT NULL,
    "bindDn" text NOT NULL,
    "bindPassword" text NOT NULL,
    "searchBase" text NOT NULL,
    "searchFilter" text,
    timeout integer DEFAULT 30 NOT NULL,
    "enableDynamicUserCreation" boolean DEFAULT true NOT NULL,
    "attributeLoginId" text DEFAULT 'uid'::text NOT NULL,
    "attributeName" text DEFAULT 'cn'::text NOT NULL,
    "attributeSurname" text DEFAULT 'sn'::text NOT NULL,
    "attributeEmail" text DEFAULT 'Email'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Link; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Link" (
    id text NOT NULL,
    url text NOT NULL,
    "displayName" text NOT NULL,
    "itemId" text NOT NULL,
    "projectId" text,
    "serviceId" text,
    "teamId" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    subject text NOT NULL,
    content text NOT NULL,
    "fromUserId" text NOT NULL,
    "toUserId" text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    "itemId" text,
    "commentId" text,
    "fromUserId" text NOT NULL,
    "toUserId" text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NotificationApp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationApp" (
    id text NOT NULL,
    name text NOT NULL,
    type public."NotificationAppType" NOT NULL,
    config text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organization" (
    id text NOT NULL,
    name text NOT NULL,
    type public."OrgType" NOT NULL,
    description text,
    "ldapDn" text,
    "parentId" text,
    "order" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Permission" (
    id text NOT NULL,
    role public."UserRole" NOT NULL,
    resource text NOT NULL,
    "canView" boolean DEFAULT false NOT NULL,
    "canCreate" boolean DEFAULT false NOT NULL,
    "canUpdate" boolean DEFAULT false NOT NULL,
    "canDelete" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "ownerId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ReportSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReportSnapshot" (
    id text NOT NULL,
    title text NOT NULL,
    "clientId" text NOT NULL,
    "clientName" text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    data text NOT NULL,
    statistics text NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SlackConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SlackConfig" (
    id text NOT NULL,
    name text NOT NULL,
    "botToken" text NOT NULL,
    "signingSecret" text,
    "appId" text,
    "clientId" text,
    "clientSecret" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userToken" text,
    "verificationToken" text
);


--
-- Name: SlackNotification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SlackNotification" (
    id text NOT NULL,
    channel text NOT NULL,
    message text NOT NULL,
    "itemId" text,
    "sentAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error text
);


--
-- Name: SystemSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemSetting" (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    "isEncrypted" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    name text NOT NULL,
    "ldapDn" text,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    "displayName" text NOT NULL,
    "phoneNumber" text,
    "ldapDn" text,
    role public."UserRole" DEFAULT 'MEMBER'::public."UserRole" NOT NULL,
    "teamId" text,
    "isVerified" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "approvalRequested" boolean DEFAULT false NOT NULL,
    "approvalRequestedAt" timestamp(3) without time zone,
    "approvalMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "organizationId" text
);


--
-- Name: WorkRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WorkRequest" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    priority public."WorkRequestPriority" DEFAULT 'MEDIUM'::public."WorkRequestPriority" NOT NULL,
    status public."WorkRequestStatus" DEFAULT 'PENDING'::public."WorkRequestStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "requesterId" text NOT NULL,
    "assigneeId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "projectId" text,
    "serviceId" text,
    "teamId" text,
    "isRecalled" boolean DEFAULT false NOT NULL,
    "isApproved" boolean DEFAULT false NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "approvedById" text,
    "actionId" text,
    "assigneeTeamId" text,
    "rejectedAt" timestamp(3) without time zone,
    "rejectedById" text,
    "rejectionMessage" text,
    "negotiationMessage" text,
    "negotiationAt" timestamp(3) without time zone,
    "negotiationById" text,
    "requestType" public."WorkRequestType" DEFAULT 'ACTION_REQUEST'::public."WorkRequestType" NOT NULL,
    "parentWorkRequestId" text,
    "targetItemType" public."ItemType",
    "createdItemId" text
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: File File_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_pkey" PRIMARY KEY (id);


--
-- Name: Item Item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_pkey" PRIMARY KEY (id);


--
-- Name: LdapConfig LdapConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LdapConfig"
    ADD CONSTRAINT "LdapConfig_pkey" PRIMARY KEY (id);


--
-- Name: Link Link_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Link"
    ADD CONSTRAINT "Link_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: NotificationApp NotificationApp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationApp"
    ADD CONSTRAINT "NotificationApp_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: Permission Permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Permission"
    ADD CONSTRAINT "Permission_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: ReportSnapshot ReportSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportSnapshot"
    ADD CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: SlackConfig SlackConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SlackConfig"
    ADD CONSTRAINT "SlackConfig_pkey" PRIMARY KEY (id);


--
-- Name: SlackNotification SlackNotification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SlackNotification"
    ADD CONSTRAINT "SlackNotification_pkey" PRIMARY KEY (id);


--
-- Name: SystemSetting SystemSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemSetting"
    ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: WorkRequest WorkRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Client_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Client_code_key" ON public."Client" USING btree (code);


--
-- Name: Comment_itemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Comment_itemId_idx" ON public."Comment" USING btree ("itemId");


--
-- Name: Comment_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Comment_userId_idx" ON public."Comment" USING btree ("userId");


--
-- Name: File_itemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "File_itemId_idx" ON public."File" USING btree ("itemId");


--
-- Name: File_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "File_projectId_idx" ON public."File" USING btree ("projectId");


--
-- Name: File_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "File_serviceId_idx" ON public."File" USING btree ("serviceId");


--
-- Name: File_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "File_teamId_idx" ON public."File" USING btree ("teamId");


--
-- Name: File_uploadedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "File_uploadedById_idx" ON public."File" USING btree ("uploadedById");


--
-- Name: Item_assigneeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Item_assigneeId_idx" ON public."Item" USING btree ("assigneeId");


--
-- Name: Item_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Item_clientId_idx" ON public."Item" USING btree ("clientId");


--
-- Name: Item_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Item_parentId_idx" ON public."Item" USING btree ("parentId");


--
-- Name: Item_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Item_status_idx" ON public."Item" USING btree (status);


--
-- Name: Item_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Item_type_idx" ON public."Item" USING btree (type);


--
-- Name: LdapConfig_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LdapConfig_name_idx" ON public."LdapConfig" USING btree (name);


--
-- Name: LdapConfig_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "LdapConfig_name_key" ON public."LdapConfig" USING btree (name);


--
-- Name: Link_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Link_createdById_idx" ON public."Link" USING btree ("createdById");


--
-- Name: Link_itemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Link_itemId_idx" ON public."Link" USING btree ("itemId");


--
-- Name: Link_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Link_projectId_idx" ON public."Link" USING btree ("projectId");


--
-- Name: Link_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Link_serviceId_idx" ON public."Link" USING btree ("serviceId");


--
-- Name: Link_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Link_teamId_idx" ON public."Link" USING btree ("teamId");


--
-- Name: Message_fromUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_fromUserId_idx" ON public."Message" USING btree ("fromUserId");


--
-- Name: Message_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_isRead_idx" ON public."Message" USING btree ("isRead");


--
-- Name: Message_toUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Message_toUserId_idx" ON public."Message" USING btree ("toUserId");


--
-- Name: NotificationApp_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationApp_name_idx" ON public."NotificationApp" USING btree (name);


--
-- Name: NotificationApp_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NotificationApp_name_key" ON public."NotificationApp" USING btree (name);


--
-- Name: NotificationApp_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationApp_type_idx" ON public."NotificationApp" USING btree (type);


--
-- Name: Notification_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_isRead_idx" ON public."Notification" USING btree ("isRead");


--
-- Name: Notification_toUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_toUserId_idx" ON public."Notification" USING btree ("toUserId");


--
-- Name: Organization_ldapDn_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_ldapDn_key" ON public."Organization" USING btree ("ldapDn");


--
-- Name: Organization_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_parentId_idx" ON public."Organization" USING btree ("parentId");


--
-- Name: Organization_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_type_idx" ON public."Organization" USING btree (type);


--
-- Name: Permission_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Permission_resource_idx" ON public."Permission" USING btree (resource);


--
-- Name: Permission_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Permission_role_idx" ON public."Permission" USING btree (role);


--
-- Name: Permission_role_resource_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Permission_role_resource_key" ON public."Permission" USING btree (role, resource);


--
-- Name: Project_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_ownerId_idx" ON public."Project" USING btree ("ownerId");


--
-- Name: ReportSnapshot_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportSnapshot_clientId_idx" ON public."ReportSnapshot" USING btree ("clientId");


--
-- Name: ReportSnapshot_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportSnapshot_createdAt_idx" ON public."ReportSnapshot" USING btree ("createdAt");


--
-- Name: ReportSnapshot_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportSnapshot_createdById_idx" ON public."ReportSnapshot" USING btree ("createdById");


--
-- Name: SlackConfig_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SlackConfig_name_idx" ON public."SlackConfig" USING btree (name);


--
-- Name: SlackConfig_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SlackConfig_name_key" ON public."SlackConfig" USING btree (name);


--
-- Name: SystemSetting_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemSetting_category_idx" ON public."SystemSetting" USING btree (category);


--
-- Name: SystemSetting_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemSetting_key_idx" ON public."SystemSetting" USING btree (key);


--
-- Name: SystemSetting_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SystemSetting_key_key" ON public."SystemSetting" USING btree (key);


--
-- Name: Team_ldapDn_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Team_ldapDn_key" ON public."Team" USING btree ("ldapDn");


--
-- Name: Team_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Team_name_key" ON public."Team" USING btree (name);


--
-- Name: User_approvalRequested_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_approvalRequested_idx" ON public."User" USING btree ("approvalRequested");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_isVerified_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_isVerified_idx" ON public."User" USING btree ("isVerified");


--
-- Name: User_organizationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_organizationId_idx" ON public."User" USING btree ("organizationId");


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: User_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_teamId_idx" ON public."User" USING btree ("teamId");


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: WorkRequest_actionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_actionId_idx" ON public."WorkRequest" USING btree ("actionId");


--
-- Name: WorkRequest_actionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WorkRequest_actionId_key" ON public."WorkRequest" USING btree ("actionId");


--
-- Name: WorkRequest_approvedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_approvedById_idx" ON public."WorkRequest" USING btree ("approvedById");


--
-- Name: WorkRequest_assigneeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_assigneeId_idx" ON public."WorkRequest" USING btree ("assigneeId");


--
-- Name: WorkRequest_assigneeTeamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_assigneeTeamId_idx" ON public."WorkRequest" USING btree ("assigneeTeamId");


--
-- Name: WorkRequest_createdItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_createdItemId_idx" ON public."WorkRequest" USING btree ("createdItemId");


--
-- Name: WorkRequest_parentWorkRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_parentWorkRequestId_idx" ON public."WorkRequest" USING btree ("parentWorkRequestId");


--
-- Name: WorkRequest_priority_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_priority_idx" ON public."WorkRequest" USING btree (priority);


--
-- Name: WorkRequest_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_projectId_idx" ON public."WorkRequest" USING btree ("projectId");


--
-- Name: WorkRequest_requestType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_requestType_idx" ON public."WorkRequest" USING btree ("requestType");


--
-- Name: WorkRequest_requesterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_requesterId_idx" ON public."WorkRequest" USING btree ("requesterId");


--
-- Name: WorkRequest_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_serviceId_idx" ON public."WorkRequest" USING btree ("serviceId");


--
-- Name: WorkRequest_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_status_idx" ON public."WorkRequest" USING btree (status);


--
-- Name: WorkRequest_teamId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WorkRequest_teamId_idx" ON public."WorkRequest" USING btree ("teamId");


--
-- Name: Comment Comment_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: File File_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: File File_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Item Item_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Item Item_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Item Item_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Item Item_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Item"
    ADD CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Link Link_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Link"
    ADD CONSTRAINT "Link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Link Link_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Link"
    ADD CONSTRAINT "Link_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Message Message_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_fromUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Notification Notification_toUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Organization Organization_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ReportSnapshot ReportSnapshot_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportSnapshot"
    ADD CONSTRAINT "ReportSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: User User_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_teamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_actionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_assigneeTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_assigneeTeamId_fkey" FOREIGN KEY ("assigneeTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_createdItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_createdItemId_fkey" FOREIGN KEY ("createdItemId") REFERENCES public."Item"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_parentWorkRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_parentWorkRequestId_fkey" FOREIGN KEY ("parentWorkRequestId") REFERENCES public."WorkRequest"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WorkRequest WorkRequest_requesterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WorkRequest"
    ADD CONSTRAINT "WorkRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict qIwzcncWatdZfjhwe26VbLi9u6yNpaav2BvbzS0bijouLAZn8m665HttqrC8Bvt

