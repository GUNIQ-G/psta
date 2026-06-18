import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { UPLOADS_DIR } from './paths';

const UPLOAD_BASE_DIR = UPLOADS_DIR;

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
    // 이미지
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    // 문서
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // 텍스트 및 코드
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    // 데이터
    'application/json',
    'text/csv',
    'application/xml',
    'text/xml',
    'text/yaml',
    'text/x-yaml',
    'application/x-yaml',
    // SQL
    'application/sql',
    'text/x-sql',
    // 압축
    'application/zip',
    'application/x-zip-compressed',
  ];

  // 확장자 기반 추가 허용 (MIME 타입이 정확하지 않은 경우 대비)
  const allowedExtensions = ['.md', '.sql', '.json', '.csv', '.xml', '.yaml', '.yml', '.log', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: images, PDF, Word, Excel, PowerPoint, text, markdown, SQL, JSON, CSV, XML, YAML, zip.'));
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

// Storage configuration for feedback images (inline editor images)
const feedbackImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOAD_BASE_DIR, 'feedback-images'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Upload configuration for feedback images
export const uploadFeedbackImage = multer({
  storage: feedbackImageStorage,
  fileFilter: fileFilter, // Images only
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Storage configuration for item description images
const itemImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(UPLOAD_BASE_DIR, 'item-images'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Upload configuration for item description images
export const uploadItemImage = multer({
  storage: itemImageStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
