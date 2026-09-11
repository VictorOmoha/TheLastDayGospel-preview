// Animation failures must never interrupt navigation or email preparation.
void import('./motion.js?v=6000607c85').catch(() => {});

const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
function closeMenu() {
  menu?.setAttribute('aria-expanded', 'false');
  nav?.classList.remove('open');
  if (nav) nav.inert = matchMedia('(max-width: 800px)').matches;
}
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
  nav.inert = !open;
});
document.addEventListener('keydown', event => { if(event.key === 'Escape' && nav?.classList.contains('open')) {closeMenu();menu.focus();} });
nav?.addEventListener('click', event => {if(event.target.closest('a')) closeMenu();});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
// Reset mobile state when switching layouts, so reopening starts consistently.
matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
closeMenu();

const topicSelect = document.querySelector('#contact-topic');
const topic = new URLSearchParams(location.search).get('topic');
if (topicSelect && [...topicSelect.options].some(option => option.value === topic)) topicSelect.value = topic;
for (const form of document.querySelectorAll('[data-email-form]')) {
  let preparedMessage = '';
  const status = form.querySelector('.form-feedback');
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    const message = String(data.get('message')).trim();
    if(!name || !message) {status.hidden=false;status.textContent='Please enter your name and a message.';return;}
    const subject = form.dataset.kind === 'prayer' ? 'Prayer request' : form.querySelector('select').selectedOptions[0].textContent;
    const body = `Name: ${name}\nEmail: ${data.get('email')}\n\n${message}`;
    preparedMessage = `To: ${form.dataset.recipient}\nSubject: ${subject}\n\n${body}`;
    const emailLink = `mailto:${form.dataset.recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.hidden = false;
    status.textContent = 'Your email draft is ready. Finish sending it in your email app. It has not been sent by this website.';
    form.querySelector('.email-fallback').hidden = false;
    form.querySelector('.copy-fallback').value = preparedMessage;
    location.href = emailLink;
  });
  form.querySelector('[data-copy-message]').addEventListener('click', async () => {
    try {await navigator.clipboard.writeText(preparedMessage);status.textContent='Message copied. Paste it into an email to the church and send when ready.';}
    catch {const fallback=form.querySelector('.copy-fallback');fallback.hidden=false;fallback.focus();fallback.select();status.textContent='Select and copy the prepared message below, then paste it into your email app.';}
  });
}

// Feature detection keeps the normal site independent of experimental browser APIs.
const formForAgent = document.querySelector('[data-email-form]');
if (formForAgent && document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = () => document.modelContext.registerTool({
    name: 'stage_church_message',
    title: 'Prepare a message to the church',
    description: 'Fill the visible contact or prayer form for review. Does not open an email app or send a message. The visitor must choose Prepare email and send it themselves.',
    inputSchema: {type:'object',properties:{name:{type:'string',maxLength:100},email:{type:'string',maxLength:200},message:{type:'string',maxLength:2000}},required:['name','email','message'],additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:true},
    execute(input) {
      if(!input || typeof input !== 'object' || Object.keys(input).some(key=>!['name','email','message'].includes(key))) throw new Error('Provide only name, email, and message.');
      for(const [field,limit] of [['name',100],['email',200],['message',2000]]) if(typeof input[field] !== 'string' || !input[field].trim() || input[field].length > limit) throw new Error(`Invalid ${field}.`);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Enter a valid email address.');
      for(const field of ['name','email','message']) formForAgent.elements.namedItem(field).value=input[field].trim();
      const feedback=formForAgent.querySelector('.form-feedback');feedback.hidden=false;feedback.textContent='Your message is filled in for review. Nothing has been sent.';
      formForAgent.scrollIntoView({block:'center',behavior:'instant'});
      return {status:'staged_for_review',sent:false,kind:formForAgent.dataset.kind};
    }
  },{signal:lifecycle.signal});
  try {Promise.resolve(register()).catch(()=>{});} catch { /* Browser support is optional. */ }
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
