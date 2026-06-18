import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.INSTALL_DATA_DIR || '/data/psta';
const INSTALL_FLAG = path.join(DATA_DIR, '.installed');

export const isInstalled = (): boolean => {
  return fs.existsSync(INSTALL_FLAG);
};

export const markInstalled = (): void => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INSTALL_FLAG, new Date().toISOString());
};
