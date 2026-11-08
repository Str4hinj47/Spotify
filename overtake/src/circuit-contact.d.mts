export const WALL_RUNOFF:number;
export function resolveCircuitWall(state:any,track:{halfWidth:number},width:number,length:number):boolean;
export function circuitCarOverlap(a:any,b:any,length:number):{depth:number;normal:[number,number]}|null;
export function resolveCircuitCarContact(a:any,b:any,length:number,preservePlayerHeading?:boolean):boolean;
