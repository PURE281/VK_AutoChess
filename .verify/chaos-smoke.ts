import { readFileSync } from 'node:fs';
import type { RosterDataset, Champion } from '../src/types';
import type { DataStore } from '../src/data';
import { createGameReducer, createInitialState } from '../src/game/engine';
const dataset=JSON.parse(readFileSync('public/data/roster.json','utf8')) as RosterDataset;
const champions=new Map<number,Champion>(dataset.characters.map(c=>[c.id,c]));
const store:DataStore={dataset,champions,season1:dataset.seasons.season1.map(id=>champions.get(id)).filter((c):c is Champion=>!!c)};
let s=createInitialState(store,4242,'chaos');
const dispatch=createGameReducer(store);
const initial={mode:s.mode,players:s.players.length,roster:s.activeRoster.length,pool:Object.values(s.pool).reduce((a,b)=>a+b,0),shop:s.players[0].shop.filter(x=>x.championId).length,ranges:[...new Set(s.activeRoster.slice(0,200).map(id=>champions.get(id)?.range))].sort()};
for(let i=0;i<5;i++){const before=s.players[0].shop.map(x=>x.championId).join();s=dispatch(s,{type:'REROLL'});if(s.players[0].shop.map(x=>x.championId).join()===before)throw new Error('reroll repeated at '+i)}
console.log(JSON.stringify({...initial,rerollsDistinct:true},null,2));
