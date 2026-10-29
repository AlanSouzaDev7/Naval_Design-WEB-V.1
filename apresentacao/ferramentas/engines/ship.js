(function(){
var C=__DATA__;
var W=1920,H=1080,PX=1;
var cv=document.getElementById('c'),cx=cv.getContext('2d'),K=1,OX=0,OY=0;
function fit(){var iw=window.innerWidth||W,ih=window.innerHeight||H,s=Math.min(iw/W,ih/H);cv.style.width=iw+'px';cv.style.height=ih+'px';cv.width=Math.round(iw*PX);cv.height=Math.round(ih*PX);K=s*PX;OX=(iw-W*s)/2*PX;OY=(ih-H*s)/2*PX;}
fit();window.addEventListener('resize',fit);
function hx(c){return[parseInt(c.substr(1,2),16),parseInt(c.substr(3,2),16),parseInt(c.substr(5,2),16)];}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function crs(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function nrm(a){var l=Math.sqrt(dot(a,a))||1;return[a[0]/l,a[1]/l,a[2]/l];}
function cl(x){return x<0?0:(x>1?1:x);}
var V=[],F=[];
function vt(x,y,z){V.push([x,y,z]);return V.length-1;}
function fc(ids,ref,col){F.push({i:ids,r:ref,c:hx(col)});}
function boxM(x0,x1,y0,y1,z0,z1,col){
 var a=vt(x0,y0,z0),b=vt(x1,y0,z0),c=vt(x1,y1,z0),d=vt(x0,y1,z0),e=vt(x0,y0,z1),f=vt(x1,y0,z1),g=vt(x1,y1,z1),h=vt(x0,y1,z1),r=vt((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
 fc([a,b,c,d],r,col);fc([e,f,g,h],r,col);fc([a,b,f,e],r,col);fc([d,c,g,h],r,col);fc([a,d,h,e],r,col);fc([b,c,g,f],r,col);
}
function frM(x0,x1,y0,y1,w0,w1,u0,u1,col){
 var a=vt(x0,y0,-w0),b=vt(x1,y0,-w0),c=vt(x1,y0,w0),d=vt(x0,y0,w0),e=vt(u0,y1,-w1),f=vt(u1,y1,-w1),g=vt(u1,y1,w1),h=vt(u0,y1,w1),r=vt((x0+x1)/2,(y0+y1)/2,0);
 fc([a,b,f,e],r,col);fc([d,c,g,h],r,col);fc([a,d,h,e],r,col);fc([b,c,g,f],r,col);fc([e,f,g,h],r,col);
}
var HL=10,HB=1.0,NS=11,s,u,x,bb,yk,yd,KP=[],WP=[],WN=[],DP=[],DN=[],hr;
function hb(u){if(u<0.7){return HB*(0.78+0.22*(1-Math.pow((0.7-u)/0.7,2)));}var q=Math.min(1,(u-0.7)/0.3);return HB*Math.pow(Math.max(0,1-Math.pow(q,1.7)),0.7);}
var BP=[],BN=[],rk,xw;
for(s=0;s<NS;s++){
 u=s/(NS-1);x=(u-0.5)*HL;bb=hb(u);yd=0.55+0.34*Math.pow(u,3);
 rk=u>0.75?Math.pow((u-0.75)/0.25,2):0;xw=x-0.45*rk;
 WP.push(vt(xw,0,bb*0.84));WN.push(vt(xw,0,-bb*0.84));
 BP.push(vt(x-0.38*rk,0.16,bb*0.9));BN.push(vt(x-0.38*rk,0.16,-bb*0.9));
 DP.push(vt(x,yd,bb));DN.push(vt(x,yd,-bb));
}
hr=vt(0,0.1,0);
for(s=0;s<NS-1;s++){
 fc([WP[s],WP[s+1],BP[s+1],BP[s]],hr,'#2A323D');
 fc([WN[s],WN[s+1],BN[s+1],BN[s]],hr,'#2A323D');
 fc([BP[s],BP[s+1],DP[s+1],DP[s]],hr,'#7D8EA3');
 fc([BN[s],BN[s+1],DN[s+1],DN[s]],hr,'#7D8EA3');
 fc([DP[s],DP[s+1],DN[s+1],DN[s]],hr,'#5E6D7D');
}
fc([WP[0],WN[0],DN[0],DP[0]],hr,'#6D7E92');
frM(-0.9,1.6,0.5,1.5,0.6,0.4,-0.55,1.25,'#A9B8C8');
boxM(0.45,1.05,1.3,1.42,-0.72,0.72,'#8D9DAF');
boxM(0.0,0.55,1.5,2.25,-0.2,0.2,'#8E9EB0');
boxM(0.2,0.3,2.25,3.3,-0.04,0.04,'#6F7F91');
boxM(0.15,0.35,2.85,2.9,-0.45,0.45,'#6F7F91');
boxM(0.0,0.5,3.3,3.4,-0.18,0.18,'#B7C5D3');
boxM(-1.9,-1.1,0.5,1.45,-0.32,0.32,'#8696A8');
boxM(-1.95,-1.05,1.45,1.5,-0.36,0.36,'#2C3947');
boxM(-2.9,-2.3,0.5,1.15,-0.28,0.28,'#8696A8');
boxM(-2.95,-2.25,1.15,1.2,-0.32,0.32,'#2C3947');
boxM(-4.2,-3.2,0.5,1.3,-0.62,0.62,'#9AA9BA');
boxM(-4.9,-4.15,0.5,0.62,-0.7,0.7,'#46535F');
boxM(1.9,2.7,0.5,0.66,-0.38,0.38,'#3F4C59');
frM(3.1,3.9,0.5,1.0,0.4,0.28,3.2,3.7,'#8FA0B3');
boxM(3.7,4.8,0.78,0.86,-0.045,0.045,'#3E4A57');
var MT=vt(0.25,3.45,0),NR=vt(0.75,1.36,-0.74),NG=vt(0.75,1.36,0.74);
var WV=[],LD=nrm([-0.45,0.8,0.4]);
function xf(tt){
 var ro=0.035*Math.sin(tt*1.1),pi=0.02*Math.sin(tt*0.9+1),bo=0.07*Math.sin(tt*1.3),cr=Math.cos(ro),sr=Math.sin(ro),cp=Math.cos(pi),sp=Math.sin(pi),i,v,y,z,xx;
 for(i=0;i<V.length;i++){v=V[i];y=v[1]*cr-v[2]*sr;z=v[1]*sr+v[2]*cr;xx=v[0]*cp-y*sp;y=v[0]*sp+y*cp+bo;WV[i]=[xx,y,z];}
}
var FX=W*C.fx,FY=H*C.fy,VW=null;
function view(tt){
 var th=C.a0+tt*C.spd,cam=[C.D*Math.cos(th),3.3,C.D*Math.sin(th)],tg=[0.2,0.7,0];
 var f=nrm(sub(tg,cam)),r=nrm(crs(f,[0,1,0])),u2=crs(r,f);
 VW={cam:cam,f:f,r:r,u:u2};
}
function pj(p){
 var d=sub(p,VW.cam),zc=dot(d,VW.f);
 if(zc<0.3){return null;}
 return[FX+C.F*dot(d,VW.r)/zc,FY-C.F*dot(d,VW.u)/zc,zc];
}
function wy(x,z,tt){return 0.10*Math.sin(x*0.55+tt*1.3+z*0.25)+0.07*Math.sin(z*0.8-tt*1.1+x*0.2);}
var HY=0,stars=[],seed=7,i;
function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647;}
view(0);
(function(){var fh=Math.sqrt(VW.f[0]*VW.f[0]+VW.f[2]*VW.f[2]),q=pj([VW.cam[0]+VW.f[0]/fh*50000,VW.cam[1],VW.cam[2]+VW.f[2]/fh*50000]);HY=q?q[1]:H*0.4;})();
for(i=0;i<120;i++){stars.push([rnd()*W,rnd()*HY*0.92,0.6+rnd()*1.4,rnd()*6]);}
var GL=[];for(i=0;i<170;i++){GL.push([rnd(),0.4+rnd(),rnd(),rnd()*6]);}
function water(side,tt){
 var arr=side>0?WP:WN,k,p,st=0;
 cx.beginPath();
 for(k=0;k<arr.length;k++){p=pj(WV[arr[k]]);if(p){if(st){cx.lineTo(p[0],p[1]);}else{cx.moveTo(p[0],p[1]);st=1;}}}
 cx.strokeStyle='rgba(225,242,250,0.45)';cx.lineWidth=2.4;cx.lineJoin='round';cx.stroke();
}
function glow(p,r,g,b,rad){
 var q=pj(p),gr;
 if(!q){return;}
 gr=cx.createRadialGradient(q[0],q[1],0,q[0],q[1],rad);gr.addColorStop(0,'rgba('+r+','+g+','+b+',0.95)');gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
 cx.fillStyle=gr;cx.beginPath();cx.arc(q[0],q[1],rad,0,Math.PI*2);cx.fill();
}
function draw(t,tt){
 var g,j,z,xx,p,st,k,sx=W*C.sx,sy=HY-170,al,hw,y;
 cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.setTransform(K,0,0,K,OX,OY);
 xf(tt);view(tt);
 g=cx.createLinearGradient(0,0,0,HY);g.addColorStop(0,'#030B17');g.addColorStop(0.6,'#0E2F52');g.addColorStop(1,'#3A6A8C');
 cx.fillStyle=g;cx.fillRect(0,0,W,HY+1);
 for(j=0;j<stars.length;j++){al=0.35+0.45*Math.sin(tt*1.7+stars[j][3]);cx.fillStyle='rgba(235,240,255,'+(al<0?0:al)+')';cx.fillRect(stars[j][0],stars[j][1],stars[j][2],stars[j][2]);}
 g=cx.createRadialGradient(sx,sy,0,sx,sy,300);g.addColorStop(0,'rgba(255,240,205,0.55)');g.addColorStop(0.15,'rgba(240,215,160,0.22)');g.addColorStop(1,'rgba(212,174,90,0)');
 cx.fillStyle=g;cx.fillRect(sx-300,sy-300,600,600);
 g=cx.createRadialGradient(sx-8,sy-8,4,sx,sy,40);g.addColorStop(0,'#FFFBEA');g.addColorStop(1,'#F3E2B4');
 cx.fillStyle=g;cx.beginPath();cx.arc(sx,sy,38,0,Math.PI*2);cx.fill();
 g=cx.createLinearGradient(0,HY,0,H);g.addColorStop(0,'#1F527A');g.addColorStop(0.35,'#0B2D4B');g.addColorStop(1,'#030E1C');
 cx.fillStyle=g;cx.fillRect(0,HY,W,H-HY);
 cx.save();cx.translate(sx,HY);cx.scale(0.22,1);
 g=cx.createRadialGradient(0,0,0,0,0,H-HY);g.addColorStop(0,'rgba(255,228,170,0.30)');g.addColorStop(0.5,'rgba(255,228,170,0.08)');g.addColorStop(1,'rgba(255,228,170,0)');
 cx.fillStyle=g;cx.fillRect(-(H-HY),0,2*(H-HY),H-HY);cx.restore();
 cx.globalCompositeOperation='lighter';
 for(j=0;j<GL.length;j++){
  y=HY+GL[j][0]*GL[j][0]*(H-HY);hw=(3+GL[j][0]*60)*GL[j][1];
  xx=sx+(GL[j][2]-0.5)*(20+GL[j][0]*300);al=0.5*(1-GL[j][0])*(0.5+0.5*Math.sin(tt*2.2+GL[j][3]));
  if(al>0.02){cx.fillStyle='rgba(255,232,180,'+al+')';cx.fillRect(xx-hw,y,hw*2,1+GL[j][0]*2.5);}
 }
 cx.globalCompositeOperation='source-over';
 cx.lineWidth=1.2;cx.lineJoin='round';
 for(z=-32;z<=32;z+=2.4){
  cx.beginPath();st=0;
  for(xx=-44;xx<=44;xx+=2.2){p=pj([xx,wy(xx,z,tt),z]);if(p){if(st){cx.lineTo(p[0],p[1]);}else{cx.moveTo(p[0],p[1]);st=1;}}}
  cx.strokeStyle='rgba(150,205,235,0.10)';cx.stroke();
 }
 for(k=0;k<37;k++){
  xx=(((k*2.4-tt*1.6)%88)+88)%88-44;
  cx.beginPath();st=0;
  for(z=-32;z<=32;z+=2.4){p=pj([xx,wy(xx,z,tt),z]);if(p){if(st){cx.lineTo(p[0],p[1]);}else{cx.moveTo(p[0],p[1]);st=1;}}}
  cx.strokeStyle='rgba(150,205,235,0.055)';cx.stroke();
 }
 for(j=-1;j<=1;j+=2){
  for(k=0;k<15;k++){
   xx=4.5-k*0.8;z=j*(0.05+(4.5-xx)*0.17)*(1+0.05*Math.sin(xx*2+tt*3));
   p=pj([xx,0.03,z]);var p2=pj([xx-0.8,0.03,j*(0.05+(5.3-xx)*0.17)*(1+0.05*Math.sin((xx-0.8)*2+tt*3))]);
   if(p){if(p2){cx.strokeStyle='rgba(235,247,255,'+(0.28*(1-k/15))+')';cx.lineWidth=2.2;cx.beginPath();cx.moveTo(p[0],p[1]);cx.lineTo(p2[0],p2[1]);cx.stroke();}}
  }
 }
 water(-1,tt);water(1,tt);
 var out=[],ii,f,a,b,c,n,cen,rf,d,sh,pts,col,m,q,ok,cd;
 for(ii=0;ii<F.length;ii++){
  f=F[ii];a=WV[f.i[0]];b=WV[f.i[1]];c=WV[f.i[2]];
  n=crs(sub(b,a),sub(c,a));
  if(dot(n,n)<1e-8){continue;}
  cen=[0,0,0];for(m=0;m<f.i.length;m++){q=WV[f.i[m]];cen[0]+=q[0];cen[1]+=q[1];cen[2]+=q[2];}
  cen=[cen[0]/f.i.length,cen[1]/f.i.length,cen[2]/f.i.length];
  rf=WV[f.r];
  if(dot(n,sub(cen,rf))<0){n=[-n[0],-n[1],-n[2]];}
  n=nrm(n);
  if(dot(n,sub(VW.cam,cen))<=0){continue;}
  pts=[];ok=1;
  for(m=0;m<f.i.length;m++){q=pj(WV[f.i[m]]);if(!q){ok=0;break;}pts.push(q);}
  if(!ok){continue;}
  d=Math.max(0,dot(n,LD));sh=0.30+0.80*d;
  col='rgb('+Math.min(255,Math.round(f.c[0]*sh+6))+','+Math.min(255,Math.round(f.c[1]*sh+12))+','+Math.min(255,Math.round(f.c[2]*sh+20))+')';
  cd=dot(sub(cen,VW.cam),VW.f);
  out.push({p:pts,c:col,d:cd});
 }
 out.sort(function(p1,p2){return p2.d-p1.d;});
 cx.lineWidth=1;cx.strokeStyle='rgba(6,14,24,0.35)';
 for(ii=0;ii<out.length;ii++){
  cx.beginPath();cx.moveTo(out[ii].p[0][0],out[ii].p[0][1]);
  for(m=1;m<out[ii].p.length;m++){cx.lineTo(out[ii].p[m][0],out[ii].p[m][1]);}
  cx.closePath();cx.fillStyle=out[ii].c;cx.fill();cx.stroke();
 }
 glow(WV[MT],255,70,60,10+6*Math.sin(tt*3));
 if(VW.cam[2]<-0.2){glow(WV[NR],255,60,50,12);}
 if(VW.cam[2]>0.2){glow(WV[NG],60,255,120,12);}
 if(C.dim){
  g=cx.createLinearGradient(0,0,W*0.62,0);g.addColorStop(0,'rgba(3,10,20,0.95)');g.addColorStop(0.55,'rgba(3,10,20,0.55)');g.addColorStop(1,'rgba(3,10,20,0)');
  cx.fillStyle=g;cx.fillRect(0,0,W,H);
 }
 g=cx.createLinearGradient(0,H*0.82,0,H);g.addColorStop(0,'rgba(3,10,20,0)');g.addColorStop(1,'rgba(3,10,20,0.75)');
 cx.fillStyle=g;cx.fillRect(0,H*0.82,W,H*0.18);
}
var T0=null,last=0,vis=true;
function loop(now){
 var t=now/1000;
 if(T0===null||now-last>700){T0=t;}
 last=now;
 if(vis){try{draw(t-T0,t);}catch(e){}}
 requestAnimationFrame(loop);
}
try{draw(0,0.5);}catch(e){}
try{new IntersectionObserver(function(e){vis=e[0].isIntersecting;},{threshold:0}).observe(cv);}catch(e){}
requestAnimationFrame(loop);
})();
