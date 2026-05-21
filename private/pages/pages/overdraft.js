(function(){
  const franchiseeSelect = document.getElementById('franchiseeSelect');
  const overdraftAllowedEl = document.getElementById('overdraftAllowed');
  const overdraftLimitEl = document.getElementById('overdraftLimit');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  const mainContent = document.getElementById('mainContent');
  const authAlert = document.getElementById('authAlert');
  const successAlert = document.getElementById('successAlert');

  const apiBase = '/api/v1/user';

  function setStatus(msg, ok){
    status.textContent = msg;
    status.style.color = ok ? 'green' : 'red';
  }

  function hideAlert() {
    successAlert.style.display = 'none';
  }

  // Check if current user has permission to manage overdraft
  async function checkPermission(){
    try {
      const res = await fetch(BASE_URL + apiBase + '/get-current-user', { credentials: 'include' });
      if(!res.ok) throw new Error('Failed to get user');
      const data = await res.json();
      const user = data?.data || data;

      if (!user.canManageOverdraft) {
        authAlert.style.display = 'block';
        mainContent.style.display = 'none';
        return false;
      }

      mainContent.style.display = 'block';
      return true;
    } catch(e) {
      setStatus('Error checking permission: ' + e.message, false);
      return false;
    }
  }

  async function fetchFranchisees(){
    try{
      setStatus('Loading franchisees...', true);
      const res = await fetch(BASE_URL + apiBase + '/get-my-franchisees', { credentials: 'include' });
      if(!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      const list = data?.data || data || [];
      franchiseeSelect.innerHTML = '';
      if(list.length === 0){
        franchiseeSelect.innerHTML = '<option value="">(no franchisees)</option>';
        setStatus('No franchisees found', false);
        return;
      }
      list.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f._id;
        opt.textContent = f.name || f.email || f._id;
        opt.dataset.overdraftAllowed = f.overdraftAllowed ? '1' : '0';
        opt.dataset.overdraftLimit = f.overdraftLimit ?? 0;
        franchiseeSelect.appendChild(opt);
      });
      setStatus('Choose a franchisee to edit', true);
      // load first
      loadSelected();
    }catch(e){
      setStatus('Error loading franchisees: ' + e.message, false);
    }
  }

  function loadSelected(){
    const opt = franchiseeSelect.selectedOptions[0];
    if(!opt) return;
    overdraftAllowedEl.checked = opt.dataset.overdraftAllowed === '1';
    overdraftLimitEl.value = opt.dataset.overdraftLimit || '';
    setStatus('', true);
  }

  franchiseeSelect.addEventListener('change', loadSelected);

  saveBtn.addEventListener('click', async ()=>{
    const franchiseeId = franchiseeSelect.value;
    if(!franchiseeId){ setStatus('Select a franchisee first', false); return; }
    const payload = {
      userId: franchiseeId,
      overdraftAllowed: !!overdraftAllowedEl.checked,
      overdraftLimit: Number(overdraftLimitEl.value) || 0
    };
    setStatus('Saving...', true);
    try{
      const res = await fetch( BASE_URL + apiBase + '/set-overdraft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if(!res.ok) throw new Error(json?.message || 'Save failed');
      setStatus('Saved successfully', true);
      // update option dataset
      const opt = franchiseeSelect.selectedOptions[0];
      opt.dataset.overdraftAllowed = payload.overdraftAllowed ? '1' : '0';
      opt.dataset.overdraftLimit = payload.overdraftLimit;
    }catch(e){
      setStatus('Error saving: ' + e.message, false);
    }
  });

  // initial
  fetchFranchisees();
})();