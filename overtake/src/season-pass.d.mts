import type {CarId} from './catalog';
export type SeasonTier = {xp:number;car:CarId;type:'tune';key:string;value:string;label:string}|{xp:number;car:CarId;type:'upgrade';key:'engine'|'tires'|'brakes';level:number;label:string};
export interface SeasonPass {period:number;xp:number;premium:boolean}
export const PREMIUM_PASS_PRICE:number;
export const PREMIUM_TIERS: readonly SeasonTier[];
export const SEASON_TIERS: readonly SeasonTier[];
export function seasonPeriod(now?:number):number;
export function seasonLabel(period:number):string;
export function sanitizeSeasonPass(raw:unknown):SeasonPass|null;
export function currentSeasonPass(raw:unknown,now?:number):SeasonPass;
