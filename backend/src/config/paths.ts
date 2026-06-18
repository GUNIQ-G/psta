import path from 'path';

export const DATA_DIR  = process.env.PSTA_DATA_DIR || '/data/psta';
export const LOG_DIR   = process.env.PSTA_LOG_DIR  || '/log/psta';

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
