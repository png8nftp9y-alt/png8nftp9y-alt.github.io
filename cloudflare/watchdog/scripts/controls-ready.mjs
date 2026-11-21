// Read-only capability check; no workflow or deployment changes here.
try {
 const response=await fetch('https://courtwatch-watchdog.ckrk9ggvrb.workers.dev/',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok||(await response.json()).workflowControlsVersion!==1)process.exitCode=1;
} catch {process.exitCode=1;}
