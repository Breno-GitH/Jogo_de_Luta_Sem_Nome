"""Separate the approved guard into head, upper gi and hanging sash.

Limbs in this import are colour references only; no original hand or trouser
silhouette is allowed to remain in the animated torso.
"""
import numpy as np
from PIL import Image,ImageDraw
from build_linked_movement import mask

class SourceRig:
 def __init__(self,base):
  self.base=base;self.arms={'near':[[103,137],[100,152],[116,151]],'far':[[147,141],[156,151],[164,136]]}
  a=np.array(base);y,x=np.mgrid[:256,:256]
  head=((y<123)&(x>=104))|mask([(123,119),(147,119),(144,130),(138,131),(126,128)])
  near=mask([(98,133),(108,134),(114,141),(114,143),(123,142),(130,143),(133,149),(130,154),(122,156),(112,160),(95,160),(94,147),(96,140)])
  far=mask([(143,137),(151,139),(156,143),(160,136),(160,130),(165,127),(171,130),(175,136),(174,153),(169,161),(150,161),(142,150),(139,144)])
  blue=np.zeros((256,256),bool)
  for c in ['071326','0c2146','173a6b','24599a','3272b5','5a91c8']:blue|=np.all(a[:,:,:3]==list(bytes.fromhex(c)),axis=2)
  cloth=blue&(y>=159)&(y<184)&(x>=119)&(x<=139)
  torso=(y<159)&~head&~near&~far&~cloth
  orange=np.zeros((256,256),bool)
  for c in ['542119','883116','ac3c0b','d95208','f67a14','ff9b2b','ffbc57']:orange|=np.all(a[:,:,:3]==list(bytes.fromhex(c)),axis=2)
  # Sleeve and lapel colour clusters belong to the gi, not to the skin cutout.
  torso|=orange&(y>=127)&(y<144)&(x>=111)&(x<=125)
  torso|=blue&(y>=130)&(y<144)&(x>=144)&(x<=153)
  self.layers={}
  for name,selected in [('head',head),('torso',torso),('cloth',cloth)]:
   layer=a.copy();layer[~selected]=0;self.layers[name]=Image.fromarray(layer)
  # Repaint the undershirt that was occluded by the source guard's fist.
  # This is a torso underlap, not a second hand carried through every frame.
  under=Image.new('RGBA',(256,256));d=ImageDraw.Draw(under)
  d.polygon([(116,141),(131,141),(133,148),(130,157),(115,157),(111,150)],fill='#0c2146')
  d.polygon([(118,142),(130,142),(130,147),(124,154),(115,154)],fill='#173a6b')
  under.alpha_composite(self.layers['torso']);self.layers['torso']=under
