const urlParams=new URLSearchParams(window.location.search),_id=urlParams.get('value1');
let allData=[],filteredData=[],currentPage=1,rowsPerPage=50;

function showLoader(msg='Loading data…'){document.getElementById('loaderMsg').textContent=msg;document.getElementById('pageLoader').style.display='flex'}
function hideLoader(){document.getElementById('pageLoader').style.display='none'}
function showToast(msg,type='success'){const t=document.getElementById('toast');t.textContent=msg;t.className=`show ${type}`;setTimeout(()=>{t.className=''},3500)}
function showSkeletonRows(n=10){const tbody=document.getElementById('test-list');tbody.innerHTML='';const w=['30%','80%','100%','55%','55%','45%','55%','70%','55%'];for(let i=0;i<n;i++){const tr=document.createElement('tr');tr.className='skeleton-row';for(let c=0;c<9;c++){const td=document.createElement('td'),div=document.createElement('div');div.className='skeleton-cell';div.style.width=w[c];td.appendChild(div);tr.appendChild(td)}tbody.appendChild(tr)}}

async function fetchFranchiseeData(){
    try{
        const res=await fetch(`${BASE_URL}/api/v1/user/superFranchisee-fetch?_id=${_id}`,{method:'GET',headers:{'Authorization':`Bearer ${localStorage.getItem('token')}`,'Content-Type':'application/json'}});
        const data=await res.json();
        if(data.success){
            const sf=data.data;
            document.getElementById('franchisee-name').value=`${sf.fullName} - ${sf.username} - (${sf.state})`;
            const badge=document.getElementById('franchisee-badge');badge.style.display='flex';
            document.getElementById('franchisee-badge-text').textContent=`${sf.username} – ${sf.fullName}`;
        }
    }catch(err){console.error('fetchFranchiseeData:',err)}
}

// FIX: normalize — API sends testId/panelId/packageId as ObjectId, not _id field
function normalize(arr,type){
    return(Array.isArray(arr)?arr:[]).map(item=>{
        const mongoId=item._id||item.testId||item.panelId||item.packageId;
        if(!mongoId)console.warn(`[normalize] Missing ID — type:${type}`,item);
        return{...item,_id:mongoId,_type:type};
    });
}

async function fetchTestList(){
    showSkeletonRows(12);
    try{
        const[testRes,panelRes,pkgRes]=await Promise.all([
            fetch(`${BASE_URL}/api/v1/user/get-test?userId=${userId}&oldId=${_id}`,{method:'POST'}),
            fetch(`${BASE_URL}/api/v1/user/get-all-pannels?userId=${userId}&oldId=${_id}`,{method:'POST'}),
            fetch(`${BASE_URL}/api/v1/user/get-all-packages?userId=${userId}&oldId=${_id}`,{method:'POST'}),
        ]);
        if(!testRes.ok||!panelRes.ok||!pkgRes.ok)throw new Error('One or more API requests failed');
        const[testData,panelData,pkgData]=await Promise.all([testRes.json(),panelRes.json(),pkgRes.json()]);
        allData=[...normalize(testData,'test'),...normalize(panelData,'panel'),...normalize(pkgData,'package')];
        filteredData=[...allData];
        document.getElementById('totalCount').textContent=`${allData.length} items`;
        currentPage=1;renderTable();renderPagination();setupSearch();setupChangePriceBtn();
    }catch(err){
        console.error('fetchTestList:',err);
        document.getElementById('test-list').innerHTML='';
        document.getElementById('noResults').style.display='flex';
        document.getElementById('noResultsMsg').textContent='Failed to load data. Please refresh.';
    }
}

function renderTable(){
    const tbody=document.getElementById('test-list'),noRes=document.getElementById('noResults'),pagBar=document.getElementById('paginationBar');
    tbody.innerHTML='';
    if(filteredData.length===0){
        noRes.style.display='flex';pagBar.style.display='none';
        const term=document.getElementById('searchTest').value.trim();
        document.getElementById('noResultsMsg').textContent=term?`No results for "${term}"`:'No data available.';
        return;
    }
    noRes.style.display='none';pagBar.style.display='flex';
    const start=(currentPage-1)*rowsPerPage,end=Math.min(start+rowsPerPage,filteredData.length),pageData=filteredData.slice(start,end);
    pageData.forEach((test,idx)=>{
        if(!test._id){console.warn('[renderTable] Skipping — missing _id:',test);return;}
        const globalIdx=start+idx+1;
        const displayId=test.testId||test.packageId||test.panelId||'';
        const displayName=test.packageName||test.testName||test.panelName||'';
        // FIX: v1 uses basePrice field
        const basePrice=parseFloat(test.basePrice??test.myPrice)||0;
        const mrpPrice=parseFloat(test.mrpPrice)||0;
        // Commission: _manualRate (user edited) > commissionToUser (from API, stored as 0–1 decimal) > calculated
        const prevFinal=parseFloat(test.finalPrice??test.assignedPriceToUser)||basePrice;
        const oldCommPct=basePrice>0?Math.round(((prevFinal-basePrice)/basePrice)*100):0;
        // FIX: commissionToUser comes from API as decimal (e.g. 0.1 = 10%) → multiply by 100 for input display
        const apiCommPct=test.commissionToUser!=null
            ?(test.commissionToUser<=1?test.commissionToUser*100:test.commissionToUser)
            :null;
        const commission=test._manualRate??apiCommPct??oldCommPct;
        // Display final price — recalculate from commission % for accuracy
        const dispFinal=basePrice+(commission/100)*basePrice;
        const assignedAmt=(dispFinal-basePrice).toFixed(2);
        const tr=document.createElement('tr');
        tr.dataset.mongoId=test._id;tr.dataset.type=test._type;
        if(test._manualRate!==undefined)tr.classList.add('manually-overridden');
        tr.innerHTML=`
<td style="text-align:center;color:var(--text-muted);font-size:11px">${globalIdx}</td>
<td class="test-id" style="font-family:'IBM Plex Mono',monospace;font-size:12px">${displayId}</td>
<td class="test-name">${displayName}</td>
<td class="test-mrp">${mrpPrice}</td>
<td class="my-price">${basePrice}</td>
<td class="commission-rate-cell${test._manualRate!==undefined?' rate-override':''}">
    <input type="number" class="commission-rate" min="0" max="100" step="0.01" value="${commission}">
</td>
<td class="assigned-price">${assignedAmt}</td>
<td class="franchisee-id" style="font-size:11px;color:var(--text-muted)">${_id}</td>
<td class="final-price1">${Number(dispFinal).toFixed(2)}</td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.commission-rate').forEach(input=>{
        input.addEventListener('input',onCommissionInput);
        const val=parseFloat(input.value);if(!isNaN(val))validateCommission(input,val);
    });
    document.getElementById('pageFrom').textContent=start+1;
    document.getElementById('pageTo').textContent=end;
    document.getElementById('pageTotal').textContent=filteredData.length;
}

function validateCommission(input,val){
    const row=input.closest('tr');
    const basePrice=parseFloat(row.querySelector('td:nth-child(5)').textContent)||0;
    const mrpPrice=parseFloat(row.querySelector('.test-mrp').textContent)||0;
    input.classList.remove('input-error','input-warn','input-ok');input.title='';
    if(input.value.trim()===''||isNaN(val)){input.classList.add('input-error');input.title='❌ Value zaroor daalni hai';return false;}
    if(val<0){input.classList.add('input-error');input.title='❌ Commission negative nahi ho sakta';return false;}
    if(val>100){input.classList.add('input-error');input.title='❌ Commission 100% se zyada nahi ho sakta';return false;}
    const finalPr=basePrice+(val/100)*basePrice;
    if(mrpPrice>0&&finalPr>mrpPrice){input.classList.add('input-warn');input.title=`⚠️ Final ₹${finalPr.toFixed(2)} MRP ₹${mrpPrice} se zyada hai`;return true;}
    input.classList.add('input-ok');return true;
}

function onCommissionInput(e){
    const input=e.target,val=parseFloat(input.value),row=input.closest('tr');
    const basePrice=parseFloat(row.querySelector('td:nth-child(5)').textContent)||0;
    validateCommission(input,val);
    const safe=isNaN(val)?0:Math.max(0,val);
    const commAmt=(safe/100)*basePrice,finalPr=basePrice+commAmt;
    row.querySelector('.assigned-price').textContent=commAmt.toFixed(2);
    row.querySelector('.final-price1').textContent=finalPr.toFixed(2);
    const globalRate=parseFloat(document.getElementById('trigger-price').value);
    if(!isNaN(globalRate)&&val!==globalRate){row.classList.add('manually-overridden');row.querySelector('.commission-rate-cell').classList.add('rate-override');}
    else{row.classList.remove('manually-overridden');row.querySelector('.commission-rate-cell').classList.remove('rate-override');}
    const mongoId=row.dataset.mongoId;
    if(mongoId){const item=allData.find(t=>t._id===mongoId);if(item)item._manualRate=isNaN(val)?undefined:val;}
    document.getElementById('statOverride').textContent=document.querySelectorAll('#test-list tr.manually-overridden').length;
}

function validateTriggerField(showFocus=false){
    const input=document.getElementById('trigger-price'),errDiv=document.getElementById('triggerError'),errMsg=document.getElementById('triggerErrorMsg');
    const rawVal=input.value.trim(),val=parseFloat(rawVal);
    input.classList.remove('field-error');errDiv.style.display='none';errDiv.classList.remove('warn');
    const showErr=(msg,isWarn=false)=>{input.classList.add('field-error');errMsg.textContent=msg;errDiv.style.display='flex';if(isWarn)errDiv.classList.add('warn');if(showFocus)input.focus();return false;};
    if(rawVal==='')return showErr('Commission % khaali nahi chhod sakte');
    if(isNaN(val))return showErr('Sirf number daalen — jaise 10 ya 15.5');
    if(val<0)return showErr('Commission negative nahi ho sakta (0–100 ke beech daalen)');
    if(val>100)return showErr('Commission 100% se zyada nahi ho sakta');
    if(val===0)return showErr('0% commission — koi markup nahi milega. Sure hain?',true);
    return true;
}

function setupChangePriceBtn(){
    document.getElementById('trigger-price').addEventListener('input',()=>validateTriggerField());
    document.getElementById('changePriceBtn').addEventListener('click',()=>{
        if(!validateTriggerField(true))return;
        const globalRate=parseFloat(document.getElementById('trigger-price').value);
        allData.forEach(item=>{item._overrideRate=globalRate;});
        document.querySelectorAll('#test-list tr').forEach(row=>{
            const basePrice=parseFloat(row.querySelector('td:nth-child(5)')?.textContent)||0;
            const mrpPrice=parseFloat(row.querySelector('.test-mrp')?.textContent)||0;
            const commAmt=(globalRate/100)*basePrice,finalPr=basePrice+commAmt;
            const input=row.querySelector('.commission-rate');if(!input)return;
            input.value=globalRate;
            input.classList.remove('input-error','input-warn','input-ok');
            if(mrpPrice>0&&finalPr>mrpPrice){input.classList.add('input-warn');input.title=`⚠️ Final ₹${finalPr.toFixed(2)} MRP ₹${mrpPrice} se zyada`;}
            else{input.classList.add('input-ok');input.title='';}
            row.querySelector('.assigned-price').textContent=commAmt.toFixed(2);
            row.querySelector('.final-price1').textContent=finalPr.toFixed(2);
            row.classList.remove('manually-overridden');row.querySelector('.commission-rate-cell').classList.remove('rate-override');
        });
        const sb=document.getElementById('statsBar');sb.style.display='flex';
        document.getElementById('statGlobalRate').textContent=globalRate;
        document.getElementById('statTotal').textContent=allData.length;
        document.getElementById('statOverride').textContent='0';
        const btn=document.getElementById('changePriceBtn'),orig=btn.innerHTML;
        btn.innerHTML='<i class="fas fa-check"></i> Applied!';btn.style.background='#16a34a';
        setTimeout(()=>{btn.innerHTML=orig;btn.style.background=''},2000);
        showToast(`${globalRate}% applied to all ${allData.length} items`);
    });
}

function setupSearch(){
    document.getElementById('searchTest').addEventListener('input',function(){
        const term=this.value.toLowerCase().trim();
        filteredData=term===''?[...allData]:allData.filter(t=>{
            const id=(t.testId||t.packageId||t.panelId||'').toLowerCase();
            const name=(t.packageName||t.testName||t.panelName||'').toLowerCase();
            return id.includes(term)||name.includes(term);
        });
        currentPage=1;renderTable();renderPagination();
    });
    document.getElementById('rowsPerPage').addEventListener('change',function(){rowsPerPage=parseInt(this.value);currentPage=1;renderTable();renderPagination();});
}

function renderPagination(){
    const totalPages=Math.ceil(filteredData.length/rowsPerPage),ctrl=document.getElementById('pageControls');
    ctrl.innerHTML='';if(totalPages<=1)return;
    const mkBtn=(label,page,disabled=false,active=false)=>{
        const btn=document.createElement('button');btn.className='page-btn'+(active?' active':'');
        btn.innerHTML=label;btn.disabled=disabled;
        btn.addEventListener('click',()=>{currentPage=page;renderTable();renderPagination();});return btn;
    };
    ctrl.appendChild(mkBtn('<i class="fas fa-chevron-left"></i>',currentPage-1,currentPage===1));
    const delta=2;let last=null;
    for(let p=1;p<=totalPages;p++){
        const inRange=p===1||p===totalPages||(p>=currentPage-delta&&p<=currentPage+delta);
        if(!inRange){if(last!==null&&last!=='…'){const ell=document.createElement('span');ell.textContent='…';ell.style.cssText='padding:0 6px;color:var(--text-muted);font-size:13px;align-self:center';ctrl.appendChild(ell);last='…';}continue;}
        ctrl.appendChild(mkBtn(p,p,false,p===currentPage));last=p;
    }
    ctrl.appendChild(mkBtn('<i class="fas fa-chevron-right"></i>',currentPage+1,currentPage===totalPages));
}

document.getElementById('saveBtn').addEventListener('click',async function(){
    const errInputs=document.querySelectorAll('#test-list .commission-rate.input-error');
    if(errInputs.length>0){errInputs[0].scrollIntoView({behavior:'smooth',block:'center'});errInputs[0].focus();showToast(`${errInputs.length} row(s) mein galat rate hai — pehle theek karein`,'error');return;}
    const overrideCount=document.querySelectorAll('#test-list tr.manually-overridden').length;
    if(overrideCount>0&&!confirm(`${overrideCount} row(s) mein alag rate set hai.\nInhe include karke save karna chahte hain?`))return;
    showLoader('Saving changes…');document.getElementById('saveStatus').textContent='';
    const domMap={};
    document.querySelectorAll('#test-list tr').forEach(row=>{
        const mongoId=row.dataset.mongoId;if(!mongoId||mongoId==='undefined')return;
        domMap[mongoId]={commissionRate:parseFloat(row.querySelector('.commission-rate')?.value||'0')/100,price:parseFloat(row.querySelector('.final-price1')?.textContent||'0')};
    });
    const itemsToSave=[];
    allData.forEach((test,index)=>{
        const mongoId=test._id;
        if(!mongoId||mongoId==='undefined'||mongoId===''){console.warn(`[save] Skipping index ${index} — missing _id`,test);return;}
        const dom=domMap[mongoId];
        const basePrice=parseFloat(test.basePrice??test.myPrice)||0;
        const prevFinal=parseFloat(test.assignedPriceToUser??test.finalPrice)||basePrice;
        const oldCommPct=basePrice>0?(prevFinal-basePrice)/basePrice:0;
        let commissionRate;
        if(dom)commissionRate=dom.commissionRate;
        else if(test._manualRate!==undefined)commissionRate=test._manualRate/100;
        else if(test._overrideRate!==undefined)commissionRate=test._overrideRate/100;
        else commissionRate=oldCommPct;
        let price;
        if(dom)price=dom.price;
        else{const pct=test._manualRate??test._overrideRate??(oldCommPct*100);price=basePrice+(pct/100)*basePrice;}
        itemsToSave.push({
            type:test._type,testId:mongoId,
            testName:test.packageName||test.testName||test.panelName||'',
            price:Number(price.toFixed(2)),
            commissionRate:Number(commissionRate.toFixed(6)),
            finalPrice:parseFloat(test.mrpPrice)||0,
            franchiseeId:_id,assignedBy:userId,
        });
    });
    console.log(`[save] ${itemsToSave.length}/${allData.length} items`);
    if(itemsToSave.length===0){hideLoader();showToast('Koi valid item nahi mila save karne ke liye','error');return;}
    try{await sendDataToBackend(itemsToSave);}catch(err){showToast('Error saving. Please try again.','error');console.error(err);}finally{hideLoader();}
});

async function sendDataToBackend(items){
    const res=await fetch(`${BASE_URL}/api/v1/user/assign-prices`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')}`},body:JSON.stringify({items})});
    const data=await res.json();
    if(res.ok){showToast(`Saved! ${data.successCount||items.length} items updated ✓`,'success');document.getElementById('saveStatus').textContent=`Last saved: ${new Date().toLocaleTimeString()}`;}
    else showToast(data.message||'Save failed','error');
}

async function init(){
    showLoader('Loading franchisee data…');await fetchFranchiseeData();hideLoader();
    showLoader('Loading rate list…');await fetchTestList();hideLoader();
}
init();
