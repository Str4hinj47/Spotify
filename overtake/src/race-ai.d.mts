import type { TrackId } from './circuit.mjs';
export interface RaceDriverProfile {pace:number;grip:number;braking:number;line:number;side:number;}
export interface RaceActor {key:number;progress:number;offset:number;speed:number;length:number;width:number;}
export interface RaceDriver extends RaceActor {targetSpeed:number;acceleration:number;profile:RaceDriverProfile;lateralSpeed:number;heading?:number;yawRate?:number;braking:boolean;passTarget:number|null;passOffset:number|null;}
export interface RacePlan {targetOffset:number;desiredSpeed:number;line:number;cornerSpeed:number;passTarget:number|null;passOffset:number|null;}
export function raceDriverProfile(index:number):RaceDriverProfile;
export function raceGap(from:number,to:number,length:number):number;
export function cornerSpeedLimit(driver:RaceDriver,trackId:TrackId,surface?:number):number;
export function planRaceDriver(driver:RaceDriver,others:RaceActor[],trackId:TrackId,surface?:number):RacePlan;
export function stepRaceDriver(driver:RaceDriver,plan:RacePlan,dt:number,trackId:TrackId,surface?:number):RaceDriver;
export function resolveRaceContacts(drivers:RaceDriver[],previous:RaceActor[],trackId:TrackId):void;
export function resolvePlayerContact(driver:RaceDriver,player:RaceActor,previousDriver:RaceActor,previousPlayerProgress:number,trackId:TrackId):boolean;
