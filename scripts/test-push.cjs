// Separate processes keep clock, timezone and fetch fixtures from leaking
// across the actual SQLite, device-time policy and service-worker checks.
const{buildSync}=require('esbuild'),{execFileSync}=require('node:child_process');
for(const suite of ['push-schedules','push-policy','push-worker']){
 const outfile=`node_modules/.cache/test-${suite}.mjs`;
 buildSync({entryPoints:[`scripts/test-${suite}.ts`],bundle:true,platform:'node',format:'esm',outfile,logLevel:'error'});
 execFileSync(process.execPath,[outfile],{stdio:'inherit'});
}
