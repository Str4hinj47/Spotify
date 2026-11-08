import type {TrackId} from './circuit.mjs';
export interface RaceMap {path:string;marker:(progress:number,offset?:number)=>{x:number;y:number};start:{x:number;y:number};width:number;height:number;}
export function createRaceMap(trackId:TrackId,width?:number,height?:number,padding?:number):RaceMap;
export interface LapTiming {lapTimes:number[];lastCrossing:number;}
export function createLapTiming():LapTiming;
export function recordLapCrossings(state:LapTiming,previous:number,current:number,elapsedBefore:number,elapsedAfter:number,length:number,laps:number):number[];
export interface RaceGap { distance:number; finished:boolean; }
export function raceGaps(playerProgress:number,rivals:{progress:number}[],finish:number):{ahead:RaceGap|null;behind:RaceGap|null};
export function lapComparison(lapTimes:number[]):{lap:number;time:number;delta:number|null;best:boolean}|null;
export function rearProximity(playerProgress:number,rivals:{progress:number}[],length:number,range?:number):number|null;
