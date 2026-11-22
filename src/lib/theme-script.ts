export const THEME_KEY = "studymed-theme";
export const STORE_KEY = "studymed-demo-v1";

/** Script executado no <head>, antes da primeira pintura: aplica tema e cores salvas (evita "piscar"). */
export const PRE_PAINT_SCRIPT = `(function(){try{
var p=localStorage.getItem("${THEME_KEY}")||"sistema";
var d=p==="escuro"||(p==="sistema"&&matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");
var s=JSON.parse(localStorage.getItem("${STORE_KEY}")||"null");
var c=s&&s.state&&s.state.categories;if(c)c.forEach(function(x){r.style.setProperty("--cat-"+x.key,x.color)});
}catch(e){}})()`;
