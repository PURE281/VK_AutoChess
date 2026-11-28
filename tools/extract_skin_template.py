"""Extract editable texture templates from a character GLB for custom skin creation.

Usage: python tools/extract_skin_template.py <unitId> [skinName]

Creates public/assets/skins/<unitId>/<skinName>/ containing:
  body.png   - body/clothing/hair/weapon texture atlas (edit in place, keep layout)
  face.png   - face texture (eyes/brows/mouth)
  skin.json  - metadata template (display name/author)

Edit the PNGs with any image editor WITHOUT moving pixels around - the UV layout
of the model expects every region to stay exactly where it is. Then run
tools/build_custom_skins.py and the skin appears in the in-game skin picker.
"""
import struct, json, sys, os
from pathlib import Path

def parse_glb(path):
    d=open(path,'rb').read()
    ln=struct.unpack('<I',d[12:16])[0]
    gltf=json.loads(d[20:20+ln])
    off=20+ln
    blen=struct.unpack('<I',d[off:off+4])[0]
    binbuf=d[off+8:off+8+blen]
    return gltf,binbuf

def extract(unit_id,skin_name):
    glb_path=Path(f'public/assets/models/{unit_id}.glb')
    if not glb_path.exists():
        print(f'ERROR: {glb_path} not found')
        return False
    gltf,binbuf=parse_glb(glb_path)
    outdir=Path(f'public/assets/skins/{unit_id}/{skin_name}')
    outdir.mkdir(parents=True,exist_ok=True)
    # map material name -> texture image buffer index
    written=[]
    for mat in gltf.get('materials',[]):
        matname=mat.get('name','')
        pbr=mat.get('pbrMetallicRoughness',{})
        texinfo=pbr.get('baseColorTexture')
        if not texinfo: continue
        tex=gltf['textures'][texinfo['index']]
        img=gltf['images'][tex['source']]
        bv=gltf['bufferViews'][img['bufferView']]
        start=bv.get('byteOffset',0)
        data=binbuf[start:start+bv['byteLength']]
        kind='body' if matname=='body_m' else 'face' if matname=='face_m' else matname
        outfile=outdir/f'{kind}.png'
        outfile.write_bytes(data)
        written.append((matname,outfile.name,len(data)))
    meta={
        'name':skin_name,
        'author':'',
        'note':'在 body.png/face.png 上原位改画即可，不要移动任何区域的位置。改完运行 python tools/build_custom_skins.py',
    }
    metafile=outdir/'skin.json'
    if not metafile.exists():
        metafile.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    for m,f,sz in written:
        print(f'  {m} -> {f} ({sz} bytes)')
    print(f'template written to {outdir}')
    print('next: edit the PNGs, then run: python tools/build_custom_skins.py')
    return True

if __name__=='__main__':
    if len(sys.argv)<2:
        print('usage: python tools/extract_skin_template.py <unitId> [skinName]')
        sys.exit(1)
    uid=sys.argv[1]
    name=sys.argv[2] if len(sys.argv)>2 else 'my-skin'
    if not extract(uid,name): sys.exit(1)
