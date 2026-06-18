import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './paths';

const INSTALL_FLAG = path.join(DATA_DIR, '.installed');

export const isInstalled = (): boolean => {
  return fs.existsSync(INSTALL_FLAG);
};

export const markInstalled = (): void => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INSTALL_FLAG, new Date().toISOString());
};
