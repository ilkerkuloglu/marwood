import sys
import numpy as np
from PIL import Image
from collections import deque
SRC=sys.argv[1]
CARDS={"adhd":1,"aktivist":3,"kafein":7,"narsist":9,"sakar":11}
SEEDS={"adhd":[(144,158),(177,158)],"aktivist":[(176,177),(216,177)],"kafein":[(173,176),(205,176)],
       "narsist":[(174,139),(207,139)],"sakar":[(181,178),(211,178)]}
for n,i in CARDS.items():
    im=np.array(Image.open(f"{SRC}/i-{i:03d}.png").convert("L"))
    dark=im<110
    for sx,sy in SEEDS[n]:
        # nearest dark pixel to seed
        ys,xs=np.nonzero(dark[sy-6:sy+7,sx-6:sx+7]); k=np.argmin((xs-6)**2+(ys-6)**2)
        st=(sy-6+ys[k],sx-6+xs[k]); seen={st}; q=deque([st])
        while q:
            y,x=q.popleft()
            for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
                p=(y+dy,x+dx)
                if p not in seen and dark[p]: seen.add(p); q.append(p)
        a=np.array(list(seen)); y0,x0=a.min(0); y1,x1=a.max(0)
        print(n, f"cx={(x0+x1+1)/2:.1f} cy={(y0+y1+1)/2:.1f} rx={(x1-x0+1)/2:.1f} ry={(y1-y0+1)/2:.1f} n={len(a)}")
