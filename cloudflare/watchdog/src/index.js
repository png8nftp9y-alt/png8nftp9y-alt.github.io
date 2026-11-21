import {WorkerEntrypoint} from 'cloudflare:workers';
import scheduler from './scheduler.mjs';
import {listWorkflowControls,setWorkflowEnabled} from './workflow-controls.mjs';
// Named RPC entrypoint is reachable only through an explicit service binding.
// The public HTTP fetch handler exposes no workflow mutation endpoint.
export class AutomationControl extends WorkerEntrypoint {
 async list(){return listWorkflowControls(this.env);}
 async set(input){return setWorkflowEnabled(this.env,input);}
}
export default scheduler;
