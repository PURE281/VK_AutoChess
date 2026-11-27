import { readFileSync } from "node:fs";
import type { RosterDataset, Champion } from "../src/types";
import type { DataStore } from "../src/data";
import { createGameReducer, createInitialState } from "../src/game/engine";
import { boardCount, deployLimit } from "../src/game/roster";
import { teamPower } from "../src/game/bots";

const dataset = JSON.parse(readFileSync("public/data/roster.json", "utf8")) as RosterDataset;
const champions = new Map<number, Champion>();
for (const champion of dataset.characters) champions.set(champion.id, champion);
const store: DataStore = { dataset, champions, season1: dataset.seasons.season1.map((id) => champions.get(id)).filter((c): c is Champion => Boolean(c)) };
let state = createInitialState(store, 424242);
const dispatch = createGameReducer(store);
for (let steps=0;state.phase!=="gameover"&&steps<220;steps++){
 const me=state.players[0];
 if(state.phase==='augment'){state=dispatch(state,{type:'CHOOSE_AUGMENT',id:state.pendingAugment!.choices[0]});continue}
 if(state.phase==='item'){state=dispatch(state,{type:'CHOOSE_ITEM',id:state.pendingItem!.choices[0]});continue}
 if(state.phase==='planning'){
  for(let i=0;i<me.shop.length;i++){
   const cid=me.shop[i].championId;const ch=cid?champions.get(cid):null;
   if(ch&&me.gold-(state.round>2?4:0)>=ch.cost){const before=me.gold;state=dispatch(state,{type:'BUY_UNIT',slot:i});if(state.players[0].gold===before)break}
  }
  const cur=state.players[0];const bi=cur.bench.findIndex(Boolean);
  if(bi>=0&&boardCount(cur)<deployLimit(cur)){
   let empty:any=null;for(let y=0;y<4&&!empty;y++)for(let x=0;x<8&&!empty;x++)if(!cur.board[`${x},${y}`])empty={x,y};
   if(empty)state=dispatch(state,{type:'MOVE_UNIT',from:{type:'bench',index:bi},to:{type:'board',x:empty.x,y:empty.y}});
  }
  if(state.players[0].gold>=20)state=dispatch(state,{type:'BUY_XP'});
  state=dispatch(state,{type:'START_COMBAT'});continue
 }
 if(state.phase==='combat'){
  if([5,8,11].includes(state.round)){
   console.log('ROUND',state.round,'type',state.roundType,'opponent',state.combat?.opponentName,'winner',state.combat?.result.winner);
   for(const p of state.players){
    const units=Object.values(p.board).map(u=>`${champions.get(u.championId)?.name}*${u.star}`).join(',')
    console.log(p.id,p.name,'hp',p.hp,'lvl',p.level,'gold',p.gold,'power',Math.round(teamPower(p,champions)),'board',units)
   }
  }
  state=dispatch(state,{type:'COMBAT_FINISHED'});continue
 }
}
