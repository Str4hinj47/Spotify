export const DRIFT_CARS: readonly string[];
export function isDriftCar(id:string): boolean;
export function stepDriftVehicle(state:any,input:any,params:any,dt:number,curvature?:number): any;
export function stepCircuitDriftVehicle(state:any,input:any,params:any,dt:number,curvature?:number):any;
