import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,tickRun,registerPass,HIGH_SPEED_THRESHOLD,HIGH_SPEED_BONUS} from '../src/run.mjs';

const advance=(run,dt,n,speed)=>{for(let i=0;i<n;i++)tickRun(run,dt,speed)};
test('oncoming passing never adds points, combo, near-miss or quest progress',()=>{
  const run=createRun('precision');
  for(let i=0;i<8;i++)assert.deepEqual(registerPass(run,'oncoming',true),{points:0,events:[]});
  assert.equal(run.score,0);assert.equal(run.combo,0);assert.equal(run.nearMisses,0);assert.equal(run.finished,false);
  assert.ok(registerPass(run,'same',true).points>0);assert.equal(run.nearMisses,1);
});
test('200 km/h bonus pays each sustained half second, is strict and resets partial intervals',()=>{
  const run=createRun('endless');
  advance(run,.1,10,HIGH_SPEED_THRESHOLD);assert.equal(run.score,0);
  advance(run,.1,4,HIGH_SPEED_THRESHOLD+.1);assert.equal(run.score,0);
  advance(run,.1,1,HIGH_SPEED_THRESHOLD+.1);assert.equal(run.score,HIGH_SPEED_BONUS);
  advance(run,.1,5,HIGH_SPEED_THRESHOLD+.1);assert.equal(run.score,2*HIGH_SPEED_BONUS);
  advance(run,.1,4,HIGH_SPEED_THRESHOLD+.1);advance(run,.1,1,HIGH_SPEED_THRESHOLD);
  advance(run,.1,4,HIGH_SPEED_THRESHOLD+.1);assert.equal(run.score,2*HIGH_SPEED_BONUS);
  advance(run,.1,1,HIGH_SPEED_THRESHOLD+.1);assert.equal(run.score,3*HIGH_SPEED_BONUS);
  assert.equal(run.combo,0);assert.equal(run.overtakes,0);
});
test('bonus works in all modes and never accrues beyond finish or time limit',()=>{
  for (const mode of ['endless','rush','trial','ghost','ranked','checkpoint','precision','speed','daily','weekly','seasonal','convoy','near']) {
    const r=createRun(mode);advance(r,.1,5,60);assert.equal(r.score,HIGH_SPEED_BONUS,mode);
  }
  const timer=createRun('rush');timer.timeLeft=.45;advance(timer,.1,5,60);assert.equal(timer.finished,true);assert.equal(timer.score,0);tickRun(timer,.1,60);assert.equal(timer.score,0);
  const trial=createRun('trial');trial.distance=2999;trial.speedBonusTime=.49;tickRun(trial,.1,60);assert.equal(trial.reason,'distance');assert.equal(trial.score,HIGH_SPEED_BONUS);
  const short=createRun('trial');short.distance=2999.9;short.speedBonusTime=.49;tickRun(short,.1,60);assert.equal(short.score,0);
  const speedy=createRun('speed');advance(speedy,.1,10,60);assert.equal(speedy.score,100); // +50 for 140+ and 2 × 25 for 200+
});
