/*主题切换组件*/
const key = 'site-theme';
const root = document.documentElement;
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const modeList = ['light','dark','auto'];

function updateBtnText(){
    const btn = document.getElementById('theme-toggle');
    const curr = localStorage.getItem(key) || 'auto';
    btn.classList.remove('light','dark','auto');
    btn.classList.add(curr);
}


function applyThemeMode(mode) {
    if(mode === 'dark'){
        root.setAttribute('data-theme','dark');
    }else if(mode === 'light'){
        root.removeAttribute('data-theme');
    }else if(mode === 'auto'){
        if(mq.matches){
            root.setAttribute('data-theme','dark');
        }else{
            root.removeAttribute('data-theme');
        }
    }
    updateBtnText();
}

(function initTheme() {
    const saved = localStorage.getItem(key);
    if(saved){
        applyThemeMode(saved);
    }else{
        localStorage.setItem(key,'auto');
        applyThemeMode('auto');
    }
})();

document.getElementById('theme-toggle').addEventListener('click', ()=>{
    let curr = localStorage.getItem(key) || 'auto';
    let idx = modeList.indexOf(curr);
    idx = (idx + 1) % modeList.length;
    const nextMode = modeList[idx];
    localStorage.setItem(key, nextMode);
    applyThemeMode(nextMode);
});

mq.addEventListener('change',(e)=>{
    const currMode = localStorage.getItem(key);
    if(currMode === 'auto'){
        applyThemeMode('auto');
    }
});

(function() {
    try {
        const key = 'site-theme';
        const saved = localStorage.getItem(key);
        const root = document.documentElement;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');

        function setThemeByMode(mode) {
            if(mode === 'dark')
                root.setAttribute('data-theme','dark');
            else if(mode === 'light')
                root.removeAttribute('data-theme');
            else if(mode === 'auto'){
                if(mq.matches)
                    root.setAttribute('data-theme','dark');
                else
                    root.removeAttribute('data-theme');
            }
        }

        if(saved)
            setThemeByMode(saved);
        else
            setThemeByMode('auto');
    } catch (e) { /* ignore */ }
})();