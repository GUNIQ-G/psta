import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import appLogger, { logHttpRequest, errorLogger } from './config/logger';
import authRoutes from './routes/auth.routes';
import itemRoutes from './routes/item.routes';
import clientRoutes from './routes/client.routes';
import settingsRoutes from './routes/settings.routes';
import orgRoutes from './routes/org.routes';
import userRoutes from './routes/user.routes';
import ldapRoutes from './routes/ldap.routes';
import permissionRoutes from './routes/permission.routes';
import boardsRoutes from './routes/boards.routes';
import notificationsRoutes from './routes/notifications.routes';
import assetsRoutes from './routes/assets.routes';
import workRoutes from './routes/work.routes';
import trashRoutes from './routes/trash.routes';

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
app.use('/api/org', orgRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ldap', ldapRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/work', workRoutes);
app.use('/api/trash', trashRoutes);

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
});