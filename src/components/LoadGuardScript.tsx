/*
 * Proteção contra a página ficar presa em "Carregando…" quando o JavaScript não
 * roda: arquivo /_next/ que falhou (HTML antigo em cache após um deploy, rede
 * instável) ou navegador sem suporte. Roda como <script> inline no <head>,
 * antes de qualquer chunk, e não depende do React.
 *
 * - falha num arquivo /_next/ → recarrega UMA vez (marca no sessionStorage);
 * - o app não ficou pronto em 20 s → mostra uma faixa com "Recarregar".
 */
const LOAD_GUARD = `(function(){
var KEY="undb-maps:reload",d=document,w=window;
function banner(msg){
  if(d.documentElement.getAttribute("data-ready")==="1"||d.getElementById("load-guard"))return;
  var b=d.createElement("div");b.id="load-guard";b.setAttribute("role","alert");
  b.style.cssText="position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:2147483647;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:16px;background:#1b0d17;color:#fff;font:500 14px/1.35 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)";
  var t=d.createElement("span");t.textContent=msg;
  var r=d.createElement("button");r.type="button";r.textContent="Recarregar";
  r.style.cssText="flex:none;min-height:40px;padding:0 14px;border:0;border-radius:10px;background:#CF004E;color:#fff;font:700 14px system-ui,sans-serif";
  r.onclick=function(){try{sessionStorage.removeItem(KEY)}catch(e){}location.reload()};
  b.appendChild(t);b.appendChild(r);(d.body||d.documentElement).appendChild(b);
}
function failed(){
  var last=0;try{last=+sessionStorage.getItem(KEY)||0}catch(e){last=-1}
  if(last>=0&&Date.now()-last>60000){try{sessionStorage.setItem(KEY,String(Date.now()))}catch(e){}location.reload();return}
  banner("Não foi possível baixar todos os arquivos do site. Verifique a conexão e tente de novo.");
}
w.addEventListener("error",function(e){
  var el=e.target,src=el&&(el.src||el.href);
  if(src&&(el.tagName==="SCRIPT"||el.tagName==="LINK")&&src.indexOf("/_next/")>-1)failed();
},true);
w.addEventListener("unhandledrejection",function(e){
  var m=String(e.reason&&(e.reason.name+" "+e.reason.message)||"");
  if(/ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i.test(m))failed();
});
setTimeout(function(){banner("O site está demorando para abrir neste aparelho. Tente recarregar ou atualizar o navegador.")},20000);
})();`;

/** Script inline para o <head> do layout raiz. */
export function LoadGuardScript() {
  return <script dangerouslySetInnerHTML={{ __html: LOAD_GUARD }} />;
}
