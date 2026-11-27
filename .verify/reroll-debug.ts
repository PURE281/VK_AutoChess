import { readFileSync } from 'node:fs';
import type { RosterDataset, Champion } from '../src/types';
import type { DataStore } from '../src/data';
import { createGameReducer, createInitialState } from '../src/game/engine';
const dataset=JSON.parse(readFileSync('public/data/roster.json','utf8')) as RosterDataset;
const champions=new Map<number,Champion>(dataset.characters.map(c=>[c.id,c]));
const store:DataStore={dataset,champions,season1:dataset.seasons.season1.map(id=>champions.get(id)).filter((c):c is Champion=>!!c)};
const reducer=createGameReducer(store);
for(const seed of [1,42,424242,1009]){
 let s=createInitialState(store,seed,'trial');
 // deploy nothing but force combat finish is impossible; directly test initial first reroll distribution too.
 for(let round=0;round<5;round++){
   const before=s.players[0].shop.map(x=>x.championId).join(',');
   const afterState=reducer(s,{type:'REROLL'});
   const after=afterState.players[0].shop.map(x=>x.championId).join(',');
   console.log(seed,round,'same?',before===after,before,'=>',after,'gold',s.players[0].gold,'round',s.round);
   s=afterState;
 }
}
