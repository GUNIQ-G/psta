import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';

// Base upload directory: /data/psta/uploads
const UPLOAD_BASE_DIR = '/data/psta/uploads';

// Storage configuration for client logos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOAD_BASE_DIR, 'client-logos'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter - only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
  }
};

// Upload configuration for client logos
export const uploadClientLogo = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Storage configuration for item files (actions, teams, services, projects)
const itemFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOAD_BASE_DIR, 'item-files'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter for item files - allow more file types
const itemFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: images, PDF, Word, Excel, PowerPoint, text, zip.'));
  }
};

// Upload configuration for item files
export const uploadItemFile = multer({
  storage: itemFileStorage,
  fileFilter: itemFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

// Storage configuration for system logos
const systemLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOAD_BASE_DIR, 'system-logos'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Upload configuration for system logos
export const uploadSystemLogo = multer({
  storage: systemLogoStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
