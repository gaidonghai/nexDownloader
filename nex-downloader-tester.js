let url = 'https://i2.sinaimg.cn/dy/deco/2012/0613/yocc20120613img01/news_logo.png';

const NexDownloader = require('./nex-downloader');
const download = new NexDownloader({
    logger: (...info) => console.log(new Date(), ...info),
    retryRequestOptions: {noResponseRetries: 2},
    timeout: 2000
}).download;

async function run() {
    let res = await download(url, {
        targetFolder: '_temp',
        filename: 'target.png',
        skipIfExist: false,
        checkSizeBeforeSkip: true,
        minimumTime: 3000
    });
    console.log(new Date(), 'Download call returned with:', res);
}

run().then(console.log.bind(console));




