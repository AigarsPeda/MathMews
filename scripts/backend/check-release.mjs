import { createRequire } from 'node:module';
import process from 'node:process';
const {validateStoreConfig}=createRequire(import.meta.url)('./release-config.cjs');
const platform=process.argv[process.argv.indexOf('--platform')+1];
if(process.argv.includes('--platform') && !['ios','android'].includes(platform)) {
 console.error('Use --platform ios or --platform android, or omit it to check both.');process.exit(1);
}
try {
 validateStoreConfig(process.env,process.argv.includes('--platform')?platform:undefined);
 console.log('Public release configuration passes. Signing, deployed deletion and reconciliation, provider credentials, privacy review, and real store purchase/device tests still require verification.');
} catch(error) { console.error(error.message);process.exit(1); }
