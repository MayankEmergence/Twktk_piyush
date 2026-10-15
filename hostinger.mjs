// Plain Node entry file for Hostinger's Express / Other application runner.
import { register } from 'tsx/esm/api';
register();
await import('./server/start.ts');
