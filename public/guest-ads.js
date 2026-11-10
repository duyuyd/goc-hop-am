if(document.body.dataset.page==='library'){
 const apply=signedIn=>{document.body.dataset.membership=signedIn?'member':'guest'};
 window.addEventListener('account:state',event=>apply(!!event.detail?.signedIn));
}
