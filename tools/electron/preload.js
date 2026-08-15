// preload.js — MC-5e 渲染进程桥（contextBridge，默认 contextIsolation:true / nodeIntegration:false）
//
// 只暴露**平坦的同步函数**（ipcRenderer.sendSync）：contextBridge 对跨上下文返回值做
// 结构化克隆，方法对象会被剥方法（见 steam-adapter.js D1——适配器类留在渲染侧 ES Module）。
// window.sgsc 契约（渲染侧消费方：web/src/steam-adapter.js）：
//   isBridge: true
//   getEnvironment(): {steam, appid, electron, platform}
//   loadSave():          {json: string|null, source: 'cloud'|'mirror'|null}
//   writeSave(json):     {ok, error?}
//   clearSave():         {ok}
//   unlockAchievement(id): {ok, alreadyUnlocked?}
//
// 同步往返说明：steamworks.js 的云文件读写是主进程同步调用，ISaveAdapter 契约又要求
// load()/save() 同步返回（见 web/src/save.js 头注），sendSync 是最小摩擦实现；
// 存档为单 JSON（<100KB 量级），阻塞可忽略。

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sgsc', {
  isBridge: true,
  getEnvironment: () => ipcRenderer.sendSync('sgsc:env'),
  loadSave: () => ipcRenderer.sendSync('sgsc:save:load'),
  writeSave: (json) => ipcRenderer.sendSync('sgsc:save:write', json),
  clearSave: () => ipcRenderer.sendSync('sgsc:save:clear'),
  unlockAchievement: (id) => ipcRenderer.sendSync('sgsc:ach:unlock', id),
});
