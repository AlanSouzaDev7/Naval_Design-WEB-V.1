(function(){
var D=__DATA__;
var W=D.w,H=D.h,PX=2,FF='"Segoe UI","Helvetica Neue",Arial,sans-serif';
var cv=document.getElementById('c'),cx=cv.getContext('2d'),K=1,OX=0,OY=0;
function fit(){var iw=window.innerWidth||W,ih=window.innerHeight||H,s=Math.min(iw/W,ih/H);cv.style.width=iw+'px';cv.style.height=ih+'px';cv.width=Math.round(iw*PX);cv.height=Math.round(ih*PX);K=s*PX;OX=(iw-W*s)/2*PX;OY=(ih-H*s)/2*PX;}
fit();window.addEventListener('resize',fit);
function hx(c){return[parseInt(c.substr(1,2),16),parseInt(c.substr(3,2),16),parseInt(c.substr(5,2),16)];}
function sh(c,f){var a=hx(c),r=[],i;for(i=0;i<3;i++){r.push(Math.round(f>=0?a[i]+(255-a[i])*f:a[i]*(1+f)));}return 'rgb('+r.join(',')+')';}
function mix(a,b,f){var p=hx(a),q=hx(b),r=[],i;for(i=0;i<3;i++){r.push(Math.round(p[i]+(q[i]-p[i])*f));}return '#'+r.map(function(v){return (v<16?'0':'')+v.toString(16);}).join('');}
function cl(x){return x<0?0:(x>1?1:x);}
function eb(x){x=cl(x);var c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);}
var L=D.l,N=L.length,RX=D.rx,RY=D.ry,TH=14,GAP=D.gap,BX=D.px,TY=D.py,cols=[],i;
for(i=0;i<N;i++){cols.push(mix('#5DB8C9','#D4AE5A',i/(N-1)));}
function rh(x,y,rx,ry){return[[x,y-ry],[x+rx,y],[x,y+ry],[x-rx,y]];}
function pl(p,f){cx.beginPath();cx.moveTo(p[0][0],p[0][1]);for(var q=1;q<p.length;q++){cx.lineTo(p[q][0],p[q][1]);}cx.closePath();cx.fillStyle=f;cx.fill();}
function draw(t,tt){
 var k,p,al,yo,cy,bob,v,gl,tp,c,g,dx;
 cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.setTransform(K,0,0,K,OX,OY);
 v=((tt/5.5)%1)*(N+1)-0.5;
 for(k=N-1;k>=0;k--){
  p=cl((t-k*0.16)/0.9);al=cl(p*2);yo=-(1-eb(p))*240;
  bob=Math.sin(tt*1.3+k*0.7)*3;cy=TY+k*GAP+bob+yo;
  gl=cl(1-Math.abs(v-k)*1.1);c=cols[k];
  cx.globalAlpha=al;
  cx.fillStyle='rgba(0,0,0,0.25)';cx.beginPath();cx.ellipse(BX+10,cy+TH+14,RX*0.95,RY*0.9,0,0,Math.PI*2);cx.fill();
  tp=rh(BX,cy,RX,RY);
  pl([tp[3],tp[2],[tp[2][0],tp[2][1]+TH],[tp[3][0],tp[3][1]+TH]],sh(c,-0.42));
  pl([tp[2],tp[1],[tp[1][0],tp[1][1]+TH],[tp[2][0],tp[2][1]+TH]],sh(c,-0.62));
  g=cx.createLinearGradient(BX-RX,cy,BX+RX,cy);g.addColorStop(0,sh(c,0.25+gl*0.2));g.addColorStop(1,sh(c,-0.05+gl*0.2));
  pl(tp,g);
  cx.strokeStyle=gl>0.05?'rgba(255,238,190,'+(0.35+gl*0.6)+')':'rgba(255,255,255,0.35)';cx.lineWidth=1.5+gl*1.5;
  cx.beginPath();cx.moveTo(tp[0][0],tp[0][1]);cx.lineTo(tp[1][0],tp[1][1]);cx.lineTo(tp[2][0],tp[2][1]);cx.lineTo(tp[3][0],tp[3][1]);cx.closePath();cx.stroke();
  cx.textAlign='center';cx.font='700 30px '+FF;cx.fillStyle='#06172A';cx.fillText(String(k+1),BX,cy+11);
  cx.strokeStyle='rgba(212,174,90,0.55)';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(BX+RX+10,cy);cx.lineTo(BX+RX+44,cy);cx.stroke();
  cx.textAlign='left';cx.font='600 28px '+FF;cx.fillStyle=gl>0.4?'#F1D58F':'#E9E4D6';cx.fillText(L[k],BX+RX+60,cy+10);
  cx.globalAlpha=1;
 }
 if(t>1.6&&v>-0.2&&v<N-0.8){
  dx=TY+v*GAP;
  g=cx.createRadialGradient(BX,dx,0,BX,dx,34);g.addColorStop(0,'rgba(255,240,200,0.95)');g.addColorStop(0.35,'rgba(212,174,90,0.55)');g.addColorStop(1,'rgba(212,174,90,0)');
  cx.fillStyle=g;cx.beginPath();cx.arc(BX,dx,34,0,Math.PI*2);cx.fill();
 }
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
