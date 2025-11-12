import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import appLogger, { logHttpRequest, errorLogger } from './config/logger';
import authRoutes from './routes/auth.routes';
import itemRoutes from './routes/item.routes';
import clientRoutes from './routes/client.routes';
import settingsRoutes from './routes/settings.routes';
import teamRoutes from './routes/team.routes';
import userRoutes from './routes/user.routes';
import ldapConfigRoutes from './routes/ldap-config.routes';
import permissionRoutes from './routes/permission.routes';
import commentRoutes from './routes/comment.routes';
import notificationRoutes from './routes/notification.routes';
import messageRoutes from './routes/message.routes';
import fileRoutes from './routes/file.routes';
import linkRoutes from './routes/link.routes';
import systemSettingsRoutes from './routes/system-settings.routes';
import ldapAdminRoutes from './routes/ldap-admin.routes';
import organizationRoutes from './routes/organization.routes';
import slackRoutes from './routes/slack.routes';
import notificationAppRoutes from './routes/notification-app.routes';
import workRequestRoutes from './routes/work-request.routes';
import reportSnapshotRoutes from './routes/report-snapshot.routes';
import ldapSyncRoutes from './routes/ldap-sync.routes';
import { startLdapSyncJob } from './jobs/ldap-sync.job';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// HTTP request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logHttpRequest(req, res, duration);
  });

  next();
});

// Serve static files from /data/psta/uploads
app.use('/uploads', express.static('/data/psta/uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ldap-configs', ldapConfigRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/ldap-admin', ldapAdminRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/slack-configs', slackRoutes);
app.use('/api/notification-apps', notificationAppRoutes);
app.use('/api/work-requests', workRequestRoutes);
app.use('/api/report-snapshots', reportSnapshotRoutes);
app.use('/api/ldap-sync', ldapSyncRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorLogger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  appLogger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    host: '0.0.0.0',
  });
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Network: accessible from external IPs`);

  // Start LDAP sync job
  startLdapSyncJob();
  console.log(`⏰ LDAP sync job scheduled (daily at 2:00 AM KST)`);
});