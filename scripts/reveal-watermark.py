"""Read export-watermark v1 and optionally reveal the PNG blue-channel text."""
import argparse,json,subprocess,zlib
from pathlib import Path
import numpy as np
def image_pixels(path):
    metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',str(path)]))['streams'][0]
    width,height=metadata['width'],metadata['height']
    if width*height>40000000:raise ValueError('Image exceeds 40 million pixels')
    raw=subprocess.check_output(['ffmpeg','-v','error','-noautorotate','-i',str(path),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','pipe:1'])
    return np.frombuffer(raw,dtype=np.uint8).reshape(height,width,4)

TEXT=b'WT1:mrtreasure.cc'
def hamming(value):
    a,b,c,d=[(value>>shift)&1 for shift in [3,2,1,0]]
    return [a^b^d,a^c^d,a,b^c^d,b,c,d]

def read_mark(path):
    pixels=image_pixels(path)
    height,width=pixels.shape[:2]
    if min(width,height)<64:raise ValueError('Image is too small')
    y=pixels[:,:,:3].astype(np.float64)@np.array([.299,.587,.114])
    rows,columns=height//16,width//16
    blocks=np.lib.stride_tricks.as_strided(y[4:,4:],shape=(rows,columns,8,8),strides=(y.strides[0]*16,y.strides[1]*16,*y.strides),writeable=False)
    yy,xx=np.mgrid[:8,:8]
    a=.25*np.cos((2*xx+1)*np.pi/16)*np.cos((2*yy+1)*2*np.pi/16)
    b=.25*np.cos((2*xx+1)*2*np.pi/16)*np.cos((2*yy+1)*np.pi/16)
    difference=np.einsum('ijxy,xy->ij',blocks,a-b)
    observed=(np.floor(difference/64+.5).astype(np.int64)&1).ravel()
    valid=(np.var(blocks,axis=(-2,-1))>=64).ravel()
    signature=zlib.crc32(TEXT).to_bytes(4,'big')
    expected=np.array([bit for byte in signature for nibble in [byte>>4,byte&15] for bit in hamming(nibble)],dtype=np.uint8)
    index=np.arange(rows*columns,dtype=np.uint64)
    slots=((((index+1)*0x45d9f3b)&0xffffffff)^(index>>16))%len(expected)
    votes=np.bincount(slots[valid].astype(np.int64),weights=observed[valid]*2.-1,minlength=len(expected))
    support=np.bincount(slots[valid].astype(np.int64),minlength=len(expected))
    codebook=np.array([hamming(n) for n in range(16)],dtype=float)*2-1
    nibbles=[int(np.argmax(codebook@votes[start:start+7])) for start in range(0,len(expected),7)]
    recovered=bytes((nibbles[i]<<4)|nibbles[i+1] for i in range(0,len(nibbles),2))
    verified=recovered==signature and np.all(support>0)
    confidence=float(np.mean(observed[valid]==expected[slots[valid].astype(np.int64)])) if np.any(valid) else 0.
    return {'version':1,'verified':bool(verified),'watermark':'mrtreasure.cc' if verified else None,'candidate':'mrtreasure.cc' if confidence>=.8 and np.count_nonzero(valid)>=500 else None,'blockAgreement':round(confidence,4),'usableBlocks':int(np.count_nonzero(valid)),'coveredBits':int(np.count_nonzero(support)),'totalBits':len(expected)},pixels

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image',type=Path)
    parser.add_argument('--channel-out',type=Path,help='Save blue-channel bit 1 as a black/white PNG; use the original exported PNG.')
    args=parser.parse_args();result,pixels=read_mark(args.image)
    if args.channel_out:
        gray=((pixels[:,:,2]&2)*127.5).astype(np.uint8);height,width=gray.shape
        subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',str(width)+'x'+str(height),'-i','pipe:0','-frames:v','1',str(args.channel_out)],input=gray.tobytes(),check=True)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    raise SystemExit(0 if result['verified'] else 1)
