import { requireAuth } from './auth.js';
import { apiRequest } from './api.js';
import { getCurrentUser, logoutUser } from './state.js';
import { toast, debounce } from './utils.js';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.addEventListener('DOMContentLoaded',async()=>{
 requireAuth();
 const u=getCurrentUser(); document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=[u?.firstName,u?.lastName].filter(Boolean).join(' ')||'Organizer'); document.querySelectorAll('[data-user-initial]').forEach(e=>e.textContent=(u?.firstName||'U')[0].toUpperCase());
 document.querySelectorAll('[data-logout]').forEach(b=>b.onclick=()=>{logoutUser();localStorage.removeItem('seatflow_token');location.href='../login.html'});
 const select=document.querySelector('[data-event-select]'), body=document.querySelector('[data-checkin-body]'), empty=document.querySelector('[data-checkin-empty]'), search=document.querySelector('[data-checkin-search]');
 let guests=[];
 try{const {events=[]}=await apiRequest('/events');select.innerHTML=events.length?events.map(e=>`<option value="${e.id}">${esc(e.name)} — ${esc(e.status)}</option>`).join(''):'<option value="">No events</option>';}catch(e){select.innerHTML='<option value="">Unable to load events</option>'}
 async function load(){if(!select.value){guests=[];render();return} try{const r=await apiRequest(`/events/${select.value}/guests`);guests=r.guests||[];render()}catch(e){toast(e.message||'Could not load guests.','error')}}
 function render(){const q=(search.value||'').trim().toLowerCase();const list=guests.filter(g=>!q||`${g.firstName} ${g.lastName}`.toLowerCase().includes(q)||(g.email||'').toLowerCase().includes(q));body.innerHTML=list.map(g=>`<tr><td><strong>${esc(g.firstName)} ${esc(g.lastName)}</strong><br><small>${esc(g.email||'')}</small></td><td>${esc(g.tableName||'—')}</td><td>${esc(g.seatNumber||'—')}</td><td>${g.checkedIn?'<span class="status-dot in">Checked in</span>':'<span class="status-dot">Not arrived</span>'}</td><td>${g.checkedIn?'—':`<button class="btn btn-primary btn-sm" data-checkin="${g.id}">Check in</button>`}</td></tr>`).join('');empty.style.display=list.length?'none':'block'}
body.addEventListener('click',async e=>{const b=e.target.closest('[data-checkin]');if(!b)return;b.disabled=true;try{await apiRequest(`/events/${select.value}/guests/${b.dataset.checkin}/check-in`,{method:'POST'});toast('Guest checked in.','success');await load()}catch(err){toast(err.message||'Check-in failed.','error');b.disabled=false}});
select.addEventListener('change',load);search.addEventListener('input',debounce(render,150));load();
});