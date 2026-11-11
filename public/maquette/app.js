// Mise à l'échelle de l'écran dans la fenêtre
(function(){
  var f=document.querySelector('.f'),w=document.getElementById('w');
  function fit(){var W=f.offsetWidth,H=f.offsetHeight,r=Math.min(1,document.documentElement.clientWidth/W);f.style.transform='scale('+r+')';f.style.transformOrigin='top left';w.style.width=W*r+'px';w.style.height=H*r+'px'}
  fit();addEventListener('resize',fit);
})();

// Piles de cartes : glisser à gauche ou à droite, le bouton valide
function Stack(el){
  var cards=[].slice.call(el.querySelectorAll(':scope > .sc')),i=0,x0=null,dx=0,lock=el.hasAttribute('data-lock');
  var box=el.closest('[data-box]')||el.parentNode;
  var cnt=box.querySelector('[data-cnt]'),dots=box.querySelector('.dots'),ok=box.querySelector('[data-ok]');
  if(dots){dots.innerHTML=cards.map(function(){return'<i></i>'}).join('')}
  function lay(){
    cards.forEach(function(c,k){var p=k-i;c.style.pointerEvents=p===0?'auto':'none';
      if(p<0){c.style.transform='translateX(-118%) rotate(-7deg)';c.style.opacity=0}
      else if(p>2){c.style.transform='translateX(56px) scale(.82)';c.style.opacity=0}
      else{c.style.transform='translateX('+(p*24)+'px) scale('+(1-p*.07)+')';c.style.opacity=p===0?1:(p===1?.92:.7)}
      c.style.zIndex=20-Math.abs(p)});
    if(cnt)cnt.textContent=(i+1)+' / '+cards.length;
    if(dots)[].forEach.call(dots.children,function(d,k){d.className=k===i?'on':''});
    if(ok){var d=cards[i]&&cards[i].classList.contains('done');ok.querySelector('span').textContent=d?(ok.dataset.next||'Suivante'):(ok.dataset.label||'Valider')}
  }
  function go(n){
    if(n>i&&lock&&!cards[i].classList.contains('done')){cards[i].classList.remove('shake');void cards[i].offsetWidth;cards[i].classList.add('shake');return}
    i=Math.max(0,Math.min(cards.length-1,n));lay()}
  var moved=false;el.addEventListener('click',function(e){if(moved){e.preventDefault();moved=false}},true);
  el.addEventListener('pointerdown',function(e){var t=e.target.closest('button,a,textarea');if(t&&!t.classList.contains('sc'))return;x0=e.clientX;dx=0;moved=false;cards[i].classList.add('drag');el.setPointerCapture(e.pointerId)});
  el.addEventListener('pointermove',function(e){if(x0===null)return;var s=document.querySelector('.f').getBoundingClientRect().width/document.querySelector('.f').offsetWidth;dx=(e.clientX-x0)/s;if(Math.abs(dx)>6)moved=true;cards[i].style.transform='translateX('+dx+'px) rotate('+(dx/28)+'deg)'});
  function up(){if(x0===null)return;x0=null;cards[i].classList.remove('drag');if(dx<-60)go(i+1);else if(dx>60)go(i-1);else lay()}
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  if(ok)ok.addEventListener('click',function(){var c=cards[i];if(c.classList.contains('done')){go(i+1);return}
    if(c.dataset.req&&c.querySelectorAll('.need').length){c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake');return}
    c.classList.add('done');if(box.querySelector('[data-pct]'))pct();setTimeout(function(){if(i<cards.length-1)go(i+1);else lay()},520)});
  el.querySelectorAll('[data-need]').forEach(function(n){n.classList.add('need')});
  el.querySelectorAll('.ch').forEach(function(b){b.addEventListener('click',function(){b.parentNode.querySelectorAll('.ch').forEach(function(x){x.classList.remove('sel')});b.classList.add('sel');var n=b.closest('[data-need]');if(n)n.classList.remove('need')})});
  function pct(){var d=cards.filter(function(c){return c.classList.contains('done')}).length;box.querySelectorAll('[data-pct]').forEach(function(p){p.textContent=Math.round(40+60*d/cards.length)+' %'})}
  if(!window._k){window._k=1;addEventListener('keydown',function(e){if(e.key==='ArrowRight')go(i+1);if(e.key==='ArrowLeft')go(i-1)})}
  lay();
}
document.querySelectorAll('.stack').forEach(Stack);

// Feuilles : signaler un souci, nous contacter
document.addEventListener('click',function(e){
  var o=e.target.closest('[data-sheet]'),f=document.querySelector('.f');
  if(o){e.preventDefault();var s=document.getElementById(o.dataset.sheet);f.querySelectorAll('.sheet').forEach(function(x){x.classList.remove('on')});s.classList.add('on');f.classList.add('open');return}
  if(e.target.closest('.veil,[data-close]')){f.classList.remove('open');return}
  var sd=e.target.closest('[data-send]');
  if(sd){var s=sd.closest('.sheet');s.querySelector('.form').style.display='none';s.querySelector('.merci').style.display='block';setTimeout(function(){f.classList.remove('open');setTimeout(function(){s.querySelector('.form').style.display='';s.querySelector('.merci').style.display='none'},400)},2400)}
  var t=e.target.closest('.tog');if(t)t.classList.toggle('off');
  var p=e.target.closest('[data-pick]');if(p){p.parentNode.querySelectorAll('[data-pick]').forEach(function(x){x.classList.remove('sel')});p.classList.add('sel')}
});
