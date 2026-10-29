(function(){
var D=__DATA__;
var W=D.w,H=D.h,PX=2,FF='"Segoe UI","Helvetica Neue",Arial,sans-serif';
var cv=document.getElementById('c'),cx=cv.getContext('2d'),K=1,OX=0,OY=0;
function fit(){var iw=window.innerWidth||W,ih=window.innerHeight||H,s=Math.min(iw/W,ih/H);cv.style.width=iw+'px';cv.style.height=ih+'px';cv.width=Math.round(iw*PX);cv.height=Math.round(ih*PX);K=s*PX;OX=(iw-W*s)/2*PX;OY=(ih-H*s)/2*PX;}
fit();window.addEventListener('resize',fit);
function hx(c){return[parseInt(c.substr(1,2),16),parseInt(c.substr(3,2),16),parseInt(c.substr(5,2),16)];}
function sh(c,f){var a=hx(c),r=[],i;for(i=0;i<3;i++){r.push(Math.round(f>=0?a[i]+(255-a[i])*f:a[i]*(1+f)));}return 'rgb('+r.join(',')+')';}
function cl(x){return x<0?0:(x>1?1:x);}
function eo(x){x=cl(x);return 1-Math.pow(1-x,3);}
var S=D.segs,N=S.length,TOT=0,i,E=0.5,R=D.R,r=D.r,TH=D.th,CXC=D.cx,CYC=D.cy,TAU=Math.PI*2;
for(i=0;i<N;i++){TOT+=S[i][0];}
function ring(a0,a1,k,ox,oy,f){
 cx.beginPath();
 cx.ellipse(CXC+ox,CYC+oy+k,R,R*E,0,a0,a1,false);
 cx.ellipse(CXC+ox,CYC+oy+k,r,r*E,0,a1,a0,true);
 cx.closePath();cx.fillStyle=f;cx.fill();
}
function draw(t,tt){
 var sweep=TAU*eo(t/1.8),rot=-Math.PI/2+tt*0.12,ph=(tt/2.4)%1,act=Math.floor(tt/2.4)%N,pop=Math.sin(ph*Math.PI);
 var acc=0,sg=[],a0,a1,lim=rot+sweep,j,k,o,mid,ox,oy,s,al,gr;
 cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.setTransform(K,0,0,K,OX,OY);
 cx.fillStyle='rgba(0,0,0,0.30)';cx.beginPath();cx.ellipse(CXC,CYC+TH+16,R*1.03,R*E*1.03,0,0,TAU);cx.fill();
 for(j=0;j<N;j++){
  a0=rot+acc/TOT*TAU;a1=rot+(acc+S[j][0])/TOT*TAU;acc+=S[j][0];
  if(a0>=lim){continue;}
  if(a1>lim){a1=lim;}
  mid=(a0+a1)/2;o=(j===act)?pop*16:0;
  sg.push({a0:a0,a1:a1,c:S[j][1],ox:Math.cos(mid)*o,oy:Math.sin(mid)*o*E});
 }
 for(k=TH;k>=2;k-=2){
  for(j=0;j<sg.length;j++){s=sg[j];ring(s.a0,s.a1,k,s.ox,s.oy,sh(s.c,-0.62+0.3*(1-k/TH)));}
 }
 for(j=0;j<sg.length;j++){
  s=sg[j];ring(s.a0,s.a1,0,s.ox,s.oy,sh(s.c,0.06));
  cx.strokeStyle='rgba(4,16,31,0.7)';cx.lineWidth=2;
  cx.beginPath();cx.ellipse(CXC+s.ox,CYC+s.oy,R,R*E,0,s.a0,s.a1,false);cx.ellipse(CXC+s.ox,CYC+s.oy,r,r*E,0,s.a1,s.a0,true);cx.closePath();cx.stroke();
 }
 al=Math.min(1,ph*8,(1-ph)*8);gr=cl(t/1.8);
 cx.globalAlpha=al*gr;cx.textAlign='center';
 cx.font='700 76px '+FF;cx.fillStyle=sh(S[act][1],0.15);cx.fillText(String(S[act][0]),CXC,CYC+4);
 var ln=D.names[act].split('\n'),q;
 cx.font='500 24px '+FF;cx.fillStyle='#E9E4D6';
 for(q=0;q<ln.length;q++){cx.fillText(ln[q],CXC,CYC+40+q*28);}
 cx.globalAlpha=1;
}
var T0=null,last=0,vis=true;
function loop(now){
 var t=now/1000;
 if(T0===null||now-last>700){T0=t;}
 last=now;
 if(vis){try{draw(t-T0,t);}catch(e){}}
 requestAnimationFrame(loop);
}
try{draw(99,0);}catch(e){}
try{new IntersectionObserver(function(e){var v=e[0].isIntersecting;if(v&&!vis){T0=performance.now()/1000;}vis=v;},{threshold:0}).observe(cv);}catch(e){}
requestAnimationFrame(loop);
})();
