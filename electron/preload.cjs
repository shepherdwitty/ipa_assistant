/**
 * 预加载：暂不暴露 Node API，仅预留扩展点。
 */
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('ipaDesktop', {
  platform: process.platform,
  isElectron: true,
})
