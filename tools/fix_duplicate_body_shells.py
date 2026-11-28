"""Remove duplicate costume-variant 'body' shells from converted GLBs.

Some character prefabs ship multiple skin/costume variants as same-named 'body'
mesh nodes (e.g. the Konosuba collab Vanir-mask variant of Loki). The original
prefab enables only one; the FBX conversion exports all of them, so the variant
shell overlaps the real head and renders as texture patchwork over the face.
This strips the smaller duplicate 'body' node subtrees from the scene graph.
Mesh/accessor data is left in the binary (harmless) - only node references are removed.
"""
import struct, json, sys, os

def load_glb(path):
    d=open(path,'rb').read()
    assert d[:4]==b'glTF'
    ln=struct.unpack('<I',d[12:16])[0]
    gltf=json.loads(d[20:20+ln])
    off=20+ln
    blen=struct.unpack('<I',d[off:off+4])[0]
    btype=d[off+4:off+8]
    binbuf=d[off+8:off+8+blen]
    return gltf,binbuf

def save_glb(path,gltf,binbuf):
    js=json.dumps(gltf,separators=(',',':')).encode()
    js+=b' ' * (-len(js)%4)
    binp=binbuf+b'\x00' * (-len(binbuf)%4)
    total=12+8+len(js)+8+len(binp)
    with open(path,'wb') as f:
        f.write(b'glTF');f.write(struct.pack('<II',2,total))
        f.write(struct.pack('<I',len(js)));f.write(b'JSON');f.write(js)
        f.write(struct.pack('<I',len(binp)));f.write(b'BIN\x00');f.write(binp)

def mesh_verts(gltf,node):
    if 'mesh' not in node: return 0
    return sum(gltf['accessors'][p['attributes']['POSITION']]['count'] for p in gltf['meshes'][node['mesh']]['primitives'])

def fix(path):
    gltf,binbuf=load_glb(path)
    nodes=gltf.get('nodes',[])
    # find all nodes named 'body' anywhere in scene graph
    body_idx=[i for i,n in enumerate(nodes) if n.get('name')=='body' and 'mesh' in n]
    if len(body_idx)<2:
        # also catch wrapper pattern: 'body' node whose only child chain leads to a mesh
        return False,'no-dup'
    verts=[(i,mesh_verts(gltf,nodes[i])) for i in body_idx]
    verts.sort(key=lambda t:-t[1])
    keep=verts[0]
    drop=[v for v in verts[1:] if v[1]<keep[1]*0.5]
    if not drop:
        return False,'sizes-similar'
    # remove drop node ids from any children arrays
    dropids={str(d[0]) for d in drop}
    dropidset={d[0] for d in drop}
    for n in nodes:
        if 'children' in n:
            n['children']=[c for c in n['children'] if c not in dropidset]
            if not n['children']: del n['children']
    for sc in gltf.get('scenes',[]):
        sc['nodes']=[c for c in sc.get('nodes',[]) if c not in dropidset]
    save_glb(path,gltf,binbuf)
    return True,f'kept {keep[1]}v, dropped '+','.join(f'{d[1]}v' for d in drop)

if __name__=='__main__':
    root=sys.argv[1] if len(sys.argv)>1 else 'public/assets/models'
    fixed=[]
    for fn in sorted(os.listdir(root)):
        if not fn.endswith('.glb'): continue
        p=os.path.join(root,fn)
        try:
            ok,msg=fix(p)
            if ok: fixed.append((fn,msg))
        except Exception as e:
            print(fn,'ERROR',e)
    for fn,msg in fixed:
        print('FIXED',fn,msg)
    print('total fixed:',len(fixed))
