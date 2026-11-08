"""Generate app icons (plate + fork/knife) into icons/."""
from PIL import Image, ImageDraw
ACC=(194,65,12); BG=(251,248,244)
def rr(d, box, radius, fill):
    x0,y0,x1,y1=box; r=min(radius,(x1-x0)/2,(y1-y0)/2)
    d.rectangle([x0+r,y0,x1-r,y1], fill=fill); d.rectangle([x0,y0+r,x1,y1-r], fill=fill)
    for cx,cy in ((x0,y0),(x1-2*r,y0),(x0,y1-2*r),(x1-2*r,y1-2*r)): d.ellipse([cx,cy,cx+2*r,cy+2*r], fill=fill)
def make(size, maskable, rounded):
    S=size*4
    im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    if rounded: rr(d, [0,0,S-1,S-1], S*0.22, ACC)
    else: d.rectangle([0,0,S,S], fill=ACC)
    k = 0.72 if maskable else 1.0
    c=S/2; r=S*0.27*k
    d.ellipse([c-r,c-r,c+r,c+r], fill=BG)
    r2=r*0.72; d.ellipse([c-r2,c-r2,c+r2,c+r2], outline=(235,222,208), width=int(S*0.012))
    w=S*0.03*k; L=S*0.30*k
    fx=c-r-S*0.085*k; kx=c+r+S*0.085*k
    rr(d, [fx-w/2,c-L,fx+w/2,c+L], w/2, BG)
    for o in (-1,0,1): rr(d, [fx+o*w*1.4-w*0.3,c-L,fx+o*w*1.4+w*0.3,c-L*0.45], w*0.3, BG)
    rr(d, [fx-w*1.9,c-L*0.5,fx+w*1.9,c-L*0.38], w*0.3, BG)
    rr(d, [kx-w/2,c-L*0.1,kx+w/2,c+L], w/2, BG)
    d.pieslice([kx-w*1.2,c-L,kx+w*1.2,c+L*0.1], 90, 270, fill=BG)
    return im.resize((size,size), Image.LANCZOS)
make(192,False,True).save('icons/icon-192.png')
make(512,False,True).save('icons/icon-512.png')
make(512,True,False).save('icons/icon-maskable-512.png')

