const fs = require('fs') 
const path = require('path') 
const https = require('https') 
const axios = require('axios') 
const yts = require('yt-search') 
const cheerio = require('cheerio') 
const fetch = require('node-fetch') 
const FormData = require('form-data') 
const { exec, spawn, execSync } = require('child_process') 

async function bk9Ai(query) {
	const teks = encodeURIComponent(query);
	const urls = ['https://bk9.fun/ai/gemini?q=','https://bk9.fun/ai/jeeves-chat?q=','https://bk9.fun/ai/jeeves-chat2?q=','https://bk9.fun/ai/mendable?q=','https://bk9.fun/ai/Aoyo?q='];
	for (let url of urls) {
		try {
			const { data } = await axios.get(url + teks);
			return data
		} catch (e) {
		}
	}
} 

async function ytMp3(url, options) {
    return new Promise((resolve, reject) => {
        ytdl.getInfo(url, options).then(async(getUrl) => {
            let result = [];
            for(let i = 0; i < getUrl.formats.length; i++) {
                let item = getUrl.formats[i];
                if (item.mimeType == 'audio/webm; codecs=\"opus\"') {
                    let { contentLength } = item;
                    let bytes = await bytesToSize(contentLength);
                    result[i] = {
                        audio: item.url,
                        size: bytes
                    };
                };
            };
            let resultFix = result.filter(x => x.audio != undefined && x.size != undefined)
            let title = getUrl.videoDetails.title;
            let desc = getUrl.videoDetails.description;
            let views = getUrl.videoDetails.viewCount;
            let likes = getUrl.videoDetails.likes;
            let dislike = getUrl.videoDetails.dislikes;
            let channel = getUrl.videoDetails.ownerChannelName;
            let uploadDate = getUrl.videoDetails.uploadDate;
            let thumb = getUrl.player_response.microformat.playerMicroformatRenderer.thumbnail.thumbnails[0].url;
            resolve({
                title,
                result: resultFix[0].audio,
                size: resultFix[0].size,
                thumb,
                views,
                likes,
                dislike,
                channel,
                uploadDate,
                desc
            });
        }).catch(reject);
    });
} 

async function multiDownload(url) {
	return new Promise(async (resolve, reject) => {
		try {
			const timeout = 60000;
			const startTime = Date.now();
			const headers = {
				'Content-Type': 'application/json',
				'Origin': 'https://publer.io',
				'Referer': 'https://publer.io/',
				'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
			}
			const { data } = await axios.post('https://app.publer.io/hooks/media', { url, iphone: false }, { headers });
			while (true) {
				if (Date.now() - startTime >= timeout) {
					reject(new Error('Loop Undefined'))
					break
				}
				const { data: res } = await axios.get('https://app.publer.io/api/v1/job_status/' + data.job_id, { headers });
				if (res.status == 'complete') {
					resolve(res.payload)
					break
				}
			}
		} catch (e) {
			reject(e)
		}
	});
}

module.exports = { bk9Ai, ytMp3, multiDownload }