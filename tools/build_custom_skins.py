"""Scan public/assets/skins/ and write public/data/custom-skins.json.

Skin folder layout:
  public/assets/skins/<unitId>/<skinKey>/
    skin.json   {"name": "...", "author": "..."}   (required)
    body.png    body texture override              (required)
    face.png    face texture override              (optional)
    icon.png    picker thumbnail                   (optional, falls back to body crop/unit icon)
"""
import json, os
from pathlib import Path

ROOT=Path('public/assets/skins')
OUT=Path('public/data/custom-skins.json')

def main():
    skins={}
    if ROOT.exists():
        for unit_dir in sorted(ROOT.iterdir()):
            if not unit_dir.is_dir() or not unit_dir.name.isdigit(): continue
            entries=[]
            for skin_dir in sorted(unit_dir.iterdir()):
                if not skin_dir.is_dir(): continue
                meta_file=skin_dir/'skin.json'
                body=skin_dir/'body.png'
                if not meta_file.exists() or not body.exists(): continue
                try:
                    meta=json.loads(meta_file.read_text(encoding='utf-8'))
                except Exception:
                    continue
                entry={
                    'key':skin_dir.name,
                    'name':meta.get('name') or skin_dir.name,
                    'author':meta.get('author',''),
                    'body':f'assets/skins/{unit_dir.name}/{skin_dir.name}/body.png',
                }
                if (skin_dir/'face.png').exists():
                    entry['face']=f'assets/skins/{unit_dir.name}/{skin_dir.name}/face.png'
                if (skin_dir/'icon.png').exists():
                    entry['icon']=f'assets/skins/{unit_dir.name}/{skin_dir.name}/icon.png'
                entries.append(entry)
            if entries:
                skins[unit_dir.name]=entries
    data={'version':1,'skins':skins}
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    total=sum(len(v) for v in skins.values())
    print(f'custom-skins.json written: {total} skins for {len(skins)} units')

if __name__=='__main__':
    main()
