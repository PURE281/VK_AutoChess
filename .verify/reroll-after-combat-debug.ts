import { readFileSync } from 'node:fs';
import type { RosterDataset, Champion } from '../src/types';
import type { DataStore } from '../src/data';
import { createGameReducer, createInitialState } from '../src/game/engine';
import { boardCount } from '../src/game/roster';
const dataset=JSON.parse(readFileSync('public/data/roster.json','utf8')) as RosterDataset;
const champions=new Map<number,Champion>(dataset.characters.map(c=>[c.id,c]));
const store:DataStore={dataset,champions,season1:dataset.seasons.season1.map(id=>champions.get(id)).filter((c):c is Champion=>!!c)};
const reducer=createGameReducer(store);
for(const seed of [1,42,424242,1009,202506]){
 let s=createInitialState(store,seed,'trial');
 for(let round=1;round<=4;round++){
   // buy first affordable then deploy if possible
   for(let i=0;i<5;i++){const before=s.players[0].gold;s=reducer(s,{type:'BUY_UNIT',slot:i});if(s.players[0].gold!==before)break}
   const bi=s.players[0].bench.findIndex(Boolean);if(bi>=0&&!boardCount(s.players[0]))s=reducer(s,{type:'MOVE_UNIT',from:{type:'bench',index:bi},to:{type:'board',x:3,y:0}});
   s=reducer(s,{type:'START_COMBAT'});s=reducer(s,{type:'COMBAT_FINISHED'});
   if(s.phase==='item'&&s.pendingItem)s=reducer(s,{type:'CHOOSE_ITEM',id:s.pendingItem.choices[0]});
   if(s.phase==='augment'&&s.pendingAugment)s=reducer(s,{type:'CHOOSE_AUGMENT',id:s.pendingAugment.choices[0]});
   if(s.phase!=='planning')break;
   const before=s.players[0].shop.map(x=>x.championId).join(',');
   const r=reducer(s,{type:'REROLL'});
   const after=r.players[0].shop.map(x=>x.championId).join(',');
   console.log(seed,'round',s.round,'same?',before===after,before,'=>',after,'gold',s.players[0].gold);
   s=r;
 }
}
