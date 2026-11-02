import {inflateSync,deflateSync} from 'node:zlib';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function chunk(type,body){const name=Buffer.from(type),header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(body.length);tail.writeUInt32BE(crc(Buffer.concat([name,body])));return Buffer.concat([header,name,body,tail]);}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
// Lossless slicing only; does not repaint or regenerate the approved artwork.
export function splitPngAtlas(png){
 if(!png.subarray(0,8).equals(signature))throw Error('Invalid PNG');let header;const pieces=[],metadata=[];
 for(let offset=8;offset<png.length;){const size=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),body=png.subarray(offset+8,offset+8+size);if(offset+12+size>png.length)throw Error('Truncated PNG');if(type==='IHDR')header=Buffer.from(body);if(type==='IDAT')pieces.push(body);if(['sRGB','gAMA','cHRM','iCCP','tRNS'].includes(type))metadata.push(chunk(type,body));offset+=12+size;}
 if(!header||header[8]!==8||![2,6].includes(header[9])||header[12]!==0)throw Error('Atlas must be non-interlaced 8-bit RGB/RGBA PNG');
 const width=header.readUInt32BE(0),height=header.readUInt32BE(4),bpp=header[9]===6?4:3,stride=width*bpp;
 if(width*height>16000000)throw Error('Atlas too large');const raw=inflateSync(Buffer.concat(pieces),{maxOutputLength:(stride+1)*height}),pixels=Buffer.alloc(stride*height);
 if(raw.length!==(stride+1)*height)throw Error('Invalid PNG scanline length');
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw Error('Invalid PNG filter');for(let x=0;x<stride;x++){const index=y*stride+x,a=x>=bpp?pixels[index-bpp]:0,b=y?pixels[index-stride]:0,c=y&&x>=bpp?pixels[index-stride-bpp]:0;pixels[index]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
 return Array.from({length:8},(_,i)=>{const x0=Math.floor(i%4*width/4),x1=Math.floor((i%4+1)*width/4),y0=Math.floor(Math.floor(i/4)*height/2),y1=Math.floor((Math.floor(i/4)+1)*height/2),w=x1-x0,h=y1-y0,rowBytes=w*bpp,data=Buffer.alloc((rowBytes+1)*h);
  for(let y=0;y<h;y++)pixels.copy(data,y*(rowBytes+1)+1,(y+y0)*stride+x0*bpp,(y+y0)*stride+x1*bpp);
  const ihdr=Buffer.from(header);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);return Buffer.concat([signature,chunk('IHDR',ihdr),...metadata,chunk('IDAT',deflateSync(data,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 });
}
