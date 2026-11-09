export const TRACK_RADIUS:number; export const TRACK_STRAIGHT:number; export const TRACK_LENGTH:number;
export const TRACK_HALF_WIDTH:number; export const RACE_LAPS:number; export const RACE_DISTANCE:number;
export function trackAt(distance:number): {x:number;z:number;yaw:number;curvature:number};
export function trackPosition(distance:number,offset?:number): {x:number;z:number;yaw:number;curvature:number};
export function racePosition(playerProgress:number,opponents:{progress:number}[]):number;
export function raceLap(progress:number):number;
export type TrackId='stadium'|'summit'|'coast'|'dockside'|'neon';
export interface Track {id:TrackId;name:string;kind:'race'|'drift';theme:string;feature:string;length:number;halfWidth:number;laps:number}
export const TRACKS: readonly Track[];
export function getTrack(id:unknown):Track;
export function trackSample(distance:number,id?:TrackId):{x:number;z:number;yaw:number;curvature:number};
export function trackPoint(distance:number,offset?:number,id?:TrackId):{x:number;z:number;yaw:number;curvature:number};
export function trackRacePosition(playerProgress:number,opponents:{progress:number}[],id?:TrackId):number;
export function trackLap(progress:number,id?:TrackId):number;
