const { default: makeWASocket, BufferJSON, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, Browsers, makeInMemoryStore, jidDecode } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom') 
const pino = require('pino') 
const util = require('util') 
const fs = require('fs') 
const path = require('path') 
const https = require('https') 
const axios = require('axios') 
const chalk = require('chalk')

const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, await, sleep } = require('./database/function') 
const { imageToWebp, imageToWebp3, videoToWebp, writeExifImg, writeExifImgAV, writeExifVid } = require('./database/exif') 

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('session') 
  const sampah = pino({ level: "silent" }) 
  const cexzas = makeWASocket({ 
    logger: sampah, 
    printQRInTerminal: true, 
    browser: Browsers.macOS('Desktop'), 
    markOnlineOnConnect: true, 
    auth: {
      creds: state.creds, 
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }).child({ level: "fatal" }))
    }
  }) 
  
  cexzas.public = true 
  cexzas.ev.on('creds.update', saveCreds) 
  cexzas.serializeM = (m) => smsg(cexzas, m, store)
  
  cexzas.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update 
    if (connection === 'close') {
      connectWhatsApp()
    } else if (connection === 'open') {
      console.log('opened connection')
    }
  }) 
  
  cexzas.decodeJid = (jid) => {
    if (!jid) return jid 
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {} 
      return decode.user && decode.server && decode.user + '@' + decode.server || jid
    } else return jid
  } 
  
  cexzas.ev.on('contacts.update', update => {
    for (let contact of update) {
      let id = cexzas.decodeJid(contact.id) 
      if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
    }
  }) 
  
  cexzas.getName = (jid, withoutContact  = false) => {
    id = cexzas.decodeJid(jid) 
    withoutContact = cexzas.withoutContact || withoutContact 
    let v 
    if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
      v = store.contacts[id] || {} 
      if (!(v.name || v.subject)) v = cexzas.groupMetadata(id) || {} 
      resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
    })
  } 
  
  cexzas.downloadMediaMessage = async (message) => {
    let mime = (message.msg || message).mimetype || '' 
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0] 
    const stream = await downloadContentFromMessage(message, messageType) 
    let buffer = Buffer.from([]) 
    for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    } 
    return buffer
  } 
  
  cexzas.sendImage = async (jid, path, caption = '', quoted = '', options) => {
    let buffer = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0) 
    return await cexzas.sendMessage(jid, { image: buffer, caption: caption, ...options }, { quoted })
  } 
  
  cexzas.sendText = (jid, text, quoted = '', options) => 
  cexzas.sendMessage(jid, { text: text, ...options }, { quoted }) 
  
  cexzas.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0) 
    let buffer 
    if (options && (options.packname || options.author)) {
      buffer = await writeExifImg(buff, options)
    } else {
      buffer = await imageToWebp(buff)
    } 
    await cexzas.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
  } 
  
  cexzas.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    let quoted = message.msg ? message.msg : message 
    let mime = (message.msg || message).mimetype || '' 
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0] 
    const stream = await downloadContentFromMessage(quoted, messageType) 
    let buffer = Buffer.from([]) 
    for await(const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    } 
    let type = await FileType.fromBuffer(buffer) 
    trueFileName = attachExtension ? (filename + '.' + type.ext) : filename 
    await fs.writeFileSync(trueFileName, buffer) 
    return trueFileName
  } 
  
  cexzas.getFile = async (PATH, save) => {
    let res 
    let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0) 
    //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer') 
    let type = await FileType.fromBuffer(data) || {
      mime: 'application/octet-stream', 
      ext: '.bin'
    } 
    filename = path.join(__filename, '../database/' + new Date * 1 + '.' + type.ext) 
    if (data && save) fs.promises.writeFile(filename, data) 
    return {
      res, 
      filename, 
      size: await getSizeMedia(data), 
      ...type, 
      data
    }
  } 
  
  cexzas.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
		async function getFileUrl(res, mime) {
			if (mime && mime.includes('gif')) {
				return cexzas.sendMessage(jid, { video: res.data, caption: caption, gifPlayback: true, ...options }, { quoted });
			} else if (mime && mime === 'application/pdf') {
				return cexzas.sendMessage(jid, { document: res.data, mimetype: 'application/pdf', caption: caption, ...options }, { quoted });
			} else if (mime && mime.includes('webp') && !/.jpg|.jpeg|.png/.test(url)) {
				return cexzas.sendAsSticker(jid, res.data, quoted, options);
			} else if (mime && mime.includes('image')) {
				return cexzas.sendMessage(jid, { image: res.data, caption: caption, ...options }, { quoted });
			} else if (mime && mime.includes('video')) {
				return cexzas.sendMessage(jid, { video: res.data, caption: caption, mimetype: 'video/mp4', ...options }, { quoted });
			} else if (mime && mime.includes('audio')) {
				return cexzas.sendMessage(jid, { audio: res.data, mimetype: 'audio/mpeg', ...options }, { quoted });
			}
		}
		const axioss = axios.create({
			httpsAgent: new https.Agent({ rejectUnauthorized: false }),
		});
		const res = await axioss.get(url, { responseType: 'arraybuffer' });
		let mime = res.headers['content-type'];
		if (!mime || mime.includes('octet-stream')) {
			const fileType = await FileType.fromBuffer(res.data);
			mime = fileType ? fileType.mime : null;
		}
		const hasil = await getFileUrl(res, mime);
		return hasil
	}
  
  cexzas.ev.on('messages.upsert', async chatUpdate => {
    try {
      mek = chatUpdate.messages[0] 
      if (!mek.message) return 
      mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message 
      if (mek.key && mek.key.remoteJid === 'status@broadcast') return 
      if (!cexzas.public && !mek.key.fromMe && chatUpdate.type === 'notify') return 
      if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return 
      m = smsg(cexzas, mek, store) 
      require("./cexzas")(cexzas, m, chatUpdate, store)
    } catch (err) {
      console.log(util.format(err))
    }
  })
} 

connectWhatsApp()