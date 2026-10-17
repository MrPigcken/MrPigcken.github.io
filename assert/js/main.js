const titles=["杨癫发骁","MrPigcken"];
let index=0;
let timer;
function autoTitle() {
    timer=setInterval(() => {
        index=(index + 1) % titles.length;
        document.title = titles[index];
    }, 1000);
}
autoTitle();
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(timer);
        document.title = "别走啊！";
    } else {
        autoTitle();
    }
})

